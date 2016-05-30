//生成随机字符串
exports.randomString = function (len) {
    len = len || 32;
    var ss = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var maxPos = ss.length;
    var pwd = '';
    for (i = 0; i < len; i++) {
        pwd += ss.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
};

//解析帐号和密码
exports.parseUserIdAndPassword = function (s) {
    var arr = s.split(' ');
    var account = {};
    account.userId = arr[1];
    account.password = arr[2];
    return account;
};

//解析成绩年份
exports.parseYear = function (s) {
    var arr = s.split(' ');
    return arr[1];
};

