const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/chatRoomControl');

router.get('/invitations', auth, ctrl.getUserInvitations);
router.post('/', auth, ctrl.createRoom);
router.get('/', auth, ctrl.getAllRooms);
router.get('/:roomId', auth, ctrl.getRoomById);
router.post('/:roomId/join', auth, ctrl.joinRoom);
router.post('/:roomId/leave', auth, ctrl.leaveRoom);
router.get('/:roomId/messages', auth, ctrl.getRoomMessages);
router.post('/:roomId/invite', auth, ctrl.inviteUser);
router.get('/:roomId/invitations', auth, ctrl.getRoomInvitations);
router.post('/invitations/:inviteId/respond', auth, ctrl.respondToInvitation);

router.delete('/:roomId', auth, ctrl.deleteRoom);  

module.exports = router;
