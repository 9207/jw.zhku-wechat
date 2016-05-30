var fs = require('fs'),
    request = require('request'),
    cheerio = require('cheerio'),
    utils = require('./utils'),
    md5 = require('md5');

var host = '202.192.94.172';

exports.downloadVC = function (session, callback) {
    var stream = request.get({
        url: "http://" + host + "/jwmis/sys/ValidateCode.aspx",
        headers: {
            'Accept': "image/png, image/svg+xml, image/*;q=0.8, */*;q=0.5",
            'Referer': "http://jw.zhku.edu.cn/jwmis/_data/index_LOGIN.aspx",
            'Accept-Encoding': "gzip, deflate",
            'Accept-Language': "zh-Hans-CN,zh-Hans;q=0.5",
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        }
    }).pipe(fs.createWriteStream('./public/pic/' + session.toString().substring(18, 28) + '.jpg'));

    stream.on('finish', function () {
        callback();
        //console.log('下载验证码完成');
    });

    stream.on('error', function (err) {
        console.error(err);
    })
};

// 获取隐藏的验证码数据
exports.obtainHideVC = function (session, callback) {
    request.get({
        url: "http://" + host + "/jwmis/znpk/Pri_StuSel.aspx",
        headers: {
            'Accept': "image/png, image/svg+xml, image/*;q=0.8, */*;q=0.5",
            'Referer': "http://jw.zhku.edu.cn/jwmis/znpk/Pri_StuSel.aspx",
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        }
    }, function (err, response, body) {
        if (err) return console.error(err);
        if (response.statusCode == '200') {
            var $ = cheerio.load(body);
            var hideVC = $("input[name='hidyzm']").val();
            console.log(hideVC);
            callback(session, hideVC);
        } else
            console.log('网络错误');
    });
};

// 获取图片的宽和高
exports.obtainWidthandHeight = function (session, hideVC) {
    var height, width;
    var s = utils.randomString(15),
        xnxq = 20140;
    var hidsjyzm = md5("11347" + xnxq + s).toUpperCase();
    request.post({
        url: "http://" + host + "/jwmis/znpk/Pri_StuSel_rpt.aspx?m=" + s,
        headers: {
            'Accept': "image/png, image/svg+xml, image/*;q=0.8, */*;q=0.5",
            'Referer': "http://jw.zhku.edu.cn/jwmis/znpk/Pri_StuSel_rpt.aspx?m=IlP5s39Rf2Y1OxM",
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        },
        form: {
            'Sel_XNXQ': xnxq,
            'rad': '0',
            'px': '0',
            'txt_yzm': '',
            'hidyzm': hideVC,
            'hidsjyzm': hidsjyzm
        }
    }, function (err, response, body) {
        if (err) return console.error(err);
        if (response.statusCode == '200') {
            var $ = cheerio.load(body);
            var src = $('#pageRpt').find('div').find('img').attr('src');
            console.log(src);
            downloadScore(session, src, function () {
                console.log('成绩下载成功');
            });
        } else
            console.log('网络错误');
    });
};

// 下载成绩图片
function downloadScore(session, src, callback) {
    var stream = request.get({
        url: "http://" + host + "/jwmis/znpk/" + src,
        headers: {
            'Accept': "image/png, image/svg+xml, image/*;q=0.8, */*;q=0.5",
            'Referer': "http://jw.zhku.edu.cn/jwmis/znpk/Pri_StuSel_rpt.aspx?m=IlP5s39Rf2Y1OxM",
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        }
    }).pipe(fs.createWriteStream('./score/score.jpg'));

    stream.on('finish', function () {
        callback();
    });
}