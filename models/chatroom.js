const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatRoomSchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  description: { 
    type: String, 
    default: 'A public chat room' 
  },
  createdOn: { 
    type: Date, 
    default: Date.now 
  },
  messageIds: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Chat' 
  }],
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  members: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  
  invitations: [{
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    invitedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'declined'], 
      default: 'pending' 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    respondedAt: { 
      type: Date 
    }
  }]
});


chatRoomSchema.statics.createRoom = async function(params) {
  const room = new this({
    name: params.name,
    description: params.description,
    createdBy: params.createdBy,
    isPrivate: params.isPrivate || false
  });
  
  if (room.isPrivate) {
    room.members.push(params.createdBy);
  }
  
  return room.save();
};

chatRoomSchema.methods.inviteUser = async function(userId, invitedBy) {
 
  if (this.members.some(memberId => memberId.toString() === userId.toString())) {
    throw new Error('User is already a member of this room');
  }
  
  const existingInvite = this.invitations.find(
    inv => inv.user.toString() === userId.toString() && inv.status === 'pending'
  );
  
  if (existingInvite) {
    throw new Error('User already has a pending invitation');
  }
 
  this.invitations.push({
    user: userId,
    invitedBy: invitedBy,
    status: 'pending'
  });
  
  return this.save();
};

chatRoomSchema.methods.respondToInvitation = async function(userId, response) {
  const invitation = this.invitations.find(
    inv => inv.user.toString() === userId.toString() && inv.status === 'pending'
  );
  
  if (!invitation) {
    throw new Error('No pending invitation found');
  }
  
  invitation.status = response; 
  invitation.respondedAt = new Date();
  
  if (response === 'accepted' && !this.members.some(memberId => memberId.toString() === userId.toString())) {
    this.members.push(userId);
  }
  
  return this.save();
};

chatRoomSchema.methods.hasAccess = function(userId) {
 
  if (!this.isPrivate) return true;

  return this.members.some(memberId => memberId.toString() === userId.toString()) || 
         this.createdBy.toString() === userId.toString();
};

chatRoomSchema.statics.getPendingInvitationsCount = async function(userId) {
  const rooms = await this.find({
    'invitations.user': userId,
    'invitations.status': 'pending'
  });
  
  let count = 0;
  rooms.forEach(room => {
    room.invitations.forEach(invite => {
      if (invite.user.toString() === userId.toString() && invite.status === 'pending') {
        count++;
      }
    });
  });
  
  return count;
};

chatRoomSchema.methods.cleanupOldInvitations = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  this.invitations = this.invitations.filter(invite => {
   
    if (invite.status === 'pending') return true;
    
    if (invite.respondedAt && invite.respondedAt > thirtyDaysAgo) return true;
 
    return false;
  });
  
  return this.save();
};

chatRoomSchema.index({ createdBy: 1 });
chatRoomSchema.index({ isPrivate: 1 });
chatRoomSchema.index({ 'invitations.user': 1, 'invitations.status': 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);