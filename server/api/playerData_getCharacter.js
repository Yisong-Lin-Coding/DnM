const Player = require('../data/mongooseDataStructure/player');
const Character = require('../data/mongooseDataStructure/character');

module.exports = (socket) => {
  // Support both correct and legacy typo event names from clients
  const handler = async (data, callback) => {
    const { playerID } = data || {};
    try {
      console.log('playerData_getCharacter called', { socketId: socket.id, playerID });
      if (!playerID) return callback({ success: false, message: 'playerID required' });

      const player = await Player.findById(playerID).populate({ path: 'characters' }).exec();
      if (!player) {
        console.warn('playerData_getCharacter: player not found', { playerID });
        return callback({ success: false, message: 'Player not found' });
      }

      const characters = (player.characters || []).map(c => ({
        id: c._id,
        name: c.name,
        class: c.class,
        race: c.race,
        level: c.level,
        currentHP: c.currentHP,
        maxHP: c.maxHP,
        inv: c.inv,
        stats: c.stats,
        actions: c.actions || [],
      }));

      console.log('playerData_getCharacter returning', { playerID, count: characters.length });
      callback({ success: true, characters });
    } catch (err) {
      console.error('Error in playerData_getCharacter:', err);
      callback({ success: false, message: err.message || 'Server error' });
    }
  };

  socket.on('playerData_getCharacter', handler);
  socket.on('playeData_getCharacter', handler); // legacy typo support
};
