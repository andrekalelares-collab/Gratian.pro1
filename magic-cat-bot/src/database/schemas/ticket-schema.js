const { Schema, model } = require('mongoose');

const ticketConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    categoryId: { type: String, required: true },
    supportRoleId: { type: String, required: true },
    messageId: { type: String, required: false },
    ticketCounter: { type: Number, default: 0 }
});

module.exports = model('TicketConfig', ticketConfigSchema);
