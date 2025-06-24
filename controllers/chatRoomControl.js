const ChatRoom = require('../models/chatroom');
const User     = require('../models/usermodel');
const { io }   = require('../server');

exports.createRoom = async (req, res, next) => {
  try {
    const { name, description, isPrivate } = req.body;
    if (await ChatRoom.findOne({ name })) {
      return res.status(400).json({ message: 'Room name already taken' });
    }
    const room = await ChatRoom.createRoom({
      name,
      description,
      createdBy: req.user._id,
      isPrivate
    });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
};

exports.getAllRooms = async (req, res, next) => {
  try {
    const rooms = await ChatRoom.find()
      .select('-messageIds')
      .populate('createdBy', 'username') 
      .lean();
    res.json(rooms);
  } catch (err) {
    next(err);
  }
};

exports.getRoomById = async (req, res, next) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId)
      .populate('members', 'username')
      .populate('createdBy', 'username') 
      .lean();
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    next(err);
  }
};

exports.joinRoom = async (req, res, next) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (room.isPrivate && !room.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (room.isPrivate && !room.members.some(memberId => memberId.toString() === req.user._id.toString())) {
      room.members.push(req.user._id);
      await room.save();
    }
    res.json(room);
  } catch (err) {
    next(err);
  }
};

exports.getRoomMessages = async (req, res, next) => {
  try {
    let { page = 1, limit = 50 } = req.query;
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const msgs = await require('../models/chatmodel')
      .find({ room: req.params.roomId })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'username')
      .lean();

    const formatted = msgs.reverse().map(m => ({
      username:  m.user?.username || 'Unknown', 
      message:   m.message,
      timestamp: m.timestamp
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

exports.leaveRoom = async (req, res, next) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    room.members = room.members.filter(
      id => id.toString() !== req.user._id.toString()
    );
    await room.save();

    res.json({ message: 'Left room successfully' });
  } catch (err) {
    next(err);
  }
};

exports.inviteUser = async (req, res, next) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'You cannot invite users to this room' });
    }

    const invitee = await User.findOne({ username: req.body.username });
    if (!invitee) {
      return res.status(404).json({ message: 'User not found' });
    }

    await room.inviteUser(invitee._id, req.user._id);


    io.emit('invitation-received', {
      userId:          invitee._id,
      invitedBy:       req.user.username,
      roomId:          room._id,
      roomName:        room.name,
      roomDescription: room.description
    });

    res.json({ message: 'Invitation sent', roomName: room.name });
  } catch (err) {
    next(err);
  }
};

exports.getUserInvitations = async (req, res, next) => {
  try {
    const rooms = await ChatRoom.find({
      'invitations.user':   req.user._id,
      'invitations.status': 'pending'
    })
    .populate('invitations.invitedBy', 'username') 
    .lean();

    const invites = [];
    rooms.forEach(room =>
      room.invitations.forEach(inv => {
        if (
          inv.user.toString() === req.user._id.toString() &&
          inv.status === 'pending'
        ) {
          invites.push({
            _id:             inv._id,
            roomId:          room._id,
            roomName:        room.name,
            roomDescription: room.description,
            invitedBy:       inv.invitedBy?.username || 'Unknown' 
          });
        }
      })
    );

    res.json(invites);
  } catch (err) {
    next(err);
  }
};

exports.respondToInvitation = async (req, res, next) => {
  try {
    const { inviteId } = req.params;
    const { response } = req.body; 

    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ message: 'Invalid response. Must be "accepted" or "declined"' });
    }

    const room = await ChatRoom.findOne({ 'invitations._id': inviteId });
    if (!room) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    await room.respondToInvitation(req.user._id, response);

    io.emit('invitation-responded', {
      username: req.user.username,
      roomId:   room._id,
      response
    });

    res.json({ message: `Invitation ${response}`, roomId: room._id });
  } catch (err) {
    next(err);
  }
};

exports.getRoomInvitations = async (req, res, next) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId)
      .populate('invitations.user', 'username')
      .populate('invitations.invitedBy', 'username')
      .lean();

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(room.invitations);
  } catch (err) {
    next(err);
  }
};
