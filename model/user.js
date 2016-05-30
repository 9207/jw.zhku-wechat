var mongoose = require('mongoose');

var UserSchema = mongoose.Schema({
    userId: {
        type: 'String'
    },
    password: {
        type: 'String'
    },
    openId: {
        type: 'String',
        unique: true
    },
    session: String,
    loginTime: {
        type: 'Date',
        default: Date.now()
    },
    validateTime: {
        type: 'Date'
    }
});

exports.User = mongoose.model('user', UserSchema);