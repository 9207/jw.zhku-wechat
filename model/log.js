var mongoose = require('mongoose');

var LogSchema = mongoose.Schema({

    userId: {
        type: 'String'
    },
    openId: {
        type: 'String'
    },
    actionTime: {
        type: 'Date',
        default: Date.now()
    },
    actionType: {
        type: 'String'
    }
});

exports.Log = mongoose.model('log', LogSchema);