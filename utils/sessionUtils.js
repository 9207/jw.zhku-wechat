var request = require('request'),
    User = require('../model/user').User,
    picUtils = require('./picUtils');

exports.getSession = function () {
    request.get({
        url: "http://jw.zhku.edu.cn/jwmis/xscj/c_ydcjrdjl_rpt.aspx",
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Host': "jw.zhku.edu.cn"
        }
    }, function (err, response, body) {
        if (err) console.error(err);
        if (response.statusCode == '200') {
            var sessionId = response.headers['set-cookie']; //获取set-cookie字段值

            User.update({userId: '201111314424'}, {$set: {session: sessionId}}, function (err, x) {
                if (err) return console.error(err);
                console.log('session写入数据库成功');
            });
            console.log('获取session成功');
            console.log('session为' + sessionId);
            // 下载验证码
            return sessionId;
        }
    })
};

exports.getSession2 = function () {
    request.get({
        url: "http://jw.zhku.edu.cn/jwmis/xscj/c_ydcjrdjl_rpt.aspx",
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Host': "jw.zhku.edu.cn"
        }
    }, function (err, response, body) {
        if (err) console.error(err);
        if (response.statusCode == '200') {
            var sessionId = response.headers['set-cookie']; //获取set-cookie字段值

            User.update({userId: '201111314424'}, {$set: {session: sessionId}}, function (err, x) {
                if (err) return console.error(err);
                console.log('session写入数据库成功');
            });
            console.log('获取session成功');
            console.log('session为' + sessionId);
            // 下载验证码
            picUtils.downloadVC(sessionId);
        }
    })
};