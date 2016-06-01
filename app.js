'use strict'
var wechat = require('wechat'),
    logger = require('morgan'),
    express = require('express'),
    request = require('request'),
    md5 = require('md5'),
    Log = require('./model/log').Log,
    cheerio = require('cheerio'),
    iconv = require('iconv-lite'),
    bufferhelper = require('bufferhelper'),
    mongoose = require('mongoose'),
    picUtils = require('./utils/picUtils'),
    User = require('./model/user').User,
    path = require('path'),
    utils = require('./utils/utils'),
    gUrl = require('./utils/url'),
    fs = require('fs');

var config = {
    token: 'nichbar',
    appid: 'wx4aaca106c58d0289',
    encodingAESKey: 'GFUqWZxNwvPgyslhwrM3coZ3xQwUAvaPtJGRY5yfnJp'
};

var app = express();

var host = gUrl.host,
    hostWithHead = 'http://' + gUrl.host,
    serverWithHead = 'http://' + gUrl.serverIP,
    createTime;

mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('数据库连接成功');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));
app.use(express.query());

app.use('/wechat', wechat(config, function (req, res, next) {
    // 微信输入信息都在req.weixin上
    var message = req.weixin,
        type = message.MsgType,
        content = message.Content,
        openid = message.FromUserName;
    createTime = message.CreateTime; //Todo createTime不应为全局...
    if (type === 'text') {
        User.findOne({
            openId: openid
        }, function (err, user) {
            if (err) return console.error(err);
            if (user != null && user.userId != '') {
                // 有教务网帐号的
                parseLoginMessage(content, user, res);
            } else if (user != null && user.userId === '') {
                // 没有绑定教务网帐号但记录了openId的
                parseMessage(content, user.openId, res);
            } else {
                // 没有绑定教务网帐号并且没有记录openId的，即首次进入的
                bindSessionAndOpenId(openid, res);
            }
        });
    }
}));

// 回复相关信息，入参JSON数据dataList和回复对象res
function replyData(dataList, res) {
    var replyMessage = '';
    for (var key in dataList) {
        replyMessage = replyMessage + dataList[key] + '\n';
    }
    if (replyMessage.length === 0)
        res.reply("服务器居然没抓取到数据。\n你确保你的格式是正确的？\n或者在那一年 or 那一学期真的有数据？\n键入'帮助'获取更多使用方法。\n还是不行的话，多半是教务网崩了。\n如果教务网没崩的话可以微博联系开发者Nich。");
    else
        res.reply(replyMessage);
}

// 记录查询信息，入参为user文档和操作名称action
function addLog(user, action) {
    var newLog = new Log({
        userId: user.userId,
        openId: user.openId,
        actionTime: createTime * 1000,
        actionType: action
    });
    newLog.save();
}

// 下载课表图片，不管它回调地狱了(格式二)
function downloadLessonPic(session, resx, callback) {
    request.get({
        url: "http://" + host + "/jwmis/znpk/Pri_StuSel.aspx",
        headers: {
            'Accept': "image/png, image/svg+xml, image/*;q=0.8, */*;q=0.5",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        }
    }, function (err, response, body) {
        if (err) return console.error(err);
        if (response.statusCode == '200') {
            var $ = cheerio.load(body);
            var hideVC = $("input[name='hidyzm']").val();
            var s = utils.randomString(15),
                xnxq = 20160; // TODO 不应写死..
            var hidsjyzm = md5("11347" + xnxq + s).toUpperCase();
            request.post({
                url: hostWithHead + "/jwmis/znpk/Pri_StuSel_rpt.aspx?m=" + s,
                headers: {
                    'Accept': "image/png, image/svg+xml, image/*;q=0.8, */*;q=0.5",
                    'Connection': "Keep-Alive",
                    'Host': host,
                    'Cookie': session
                },
                form: {
                    'Sel_XNXQ': xnxq,
                    'rad': '1',
                    'px': '0',
                    'txt_yzm': '',
                    'hidyzm': hideVC,
                    'hidsjyzm': hidsjyzm
                }
            }, function (err, response, body) {
                if (err) return console.error(err);
                if (response.statusCode == '200') {
                    var $ = cheerio.load(body);
                    var src = $('img').attr('src');
                    var stream = request.get({
                        url: "http://" + host + "/jwmis/znpk/" + src,
                        headers: {
                            'Accept': "image/png, image/svg+xml, image/*;q=0.8, */*;q=0.5",
                            'Connection': "Keep-Alive",
                            'Host': host,
                            'Cookie': session
                        }
                    }).pipe(fs.createWriteStream('./public/kebiao/' + session.toString().substring(18, 28) + '.jpg'));

                    stream.on('finish', function () {
                        callback();
                    });
                } else {
                    console.log('下载课表图片时网络错误');
                    resx.reply('下载课表图片时网络错误');
                }
            });
        } else {
            console.log('获取隐藏验证码时网络错误');
            resx.reply('获取隐藏验证码时网络错误');
        }
    });
}

// 获取四六级成绩，入参为session和回调函数
function getCetScore(session, callback) {
    var req = request.get({
        url: hostWithHead + gUrl.cetScoreURL,
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        }
    }, function (err, res, body) {
        if (err) return console.log(err);
    });

    req.on('response', function (res) {
        var bufferHelper = new bufferhelper();
        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        }).on('end', function () {
            var result = iconv.decode(bufferHelper.toBuffer(), 'GBK');
            var $ = cheerio.load(result);
            var dataList = {};
            var keyB = 0, keyH = 1, value;
            // 打印四六级成绩
            $('.B').each(function (index, el) {
                keyB = keyB + 2;
                value = (($(el.children).eq(0).text()) + " " + $(el.children).eq(1).text() + " " + $(el.children).eq(2).text() + " " + $(el.children).eq(4).text());
                if (keyB)
                    dataList[keyB] = value;
            });
            $('.H').each(function (index, el) {
                keyH = keyH + 2;
                value = (($(el.children).eq(0).text()) + " " + $(el.children).eq(1).text() + " " + $(el.children).eq(2).text() + " " + $(el.children).eq(4).text());
                if (keyH)
                    dataList[keyH] = value;
            });
            callback(dataList);
        });
    });
}

// 获取成绩分布，入参为session和回调函数
function getAllTimeScoreDistribute(session, callback) {
    var req = request.post({
        url: hostWithHead + gUrl.scoreDistributeURL,
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        },
        form: {
            SelXNXQ: 0,
            submit: '检索'
        }
    }, function (err, res, body) {
        if (err) return console.log(err);
    });

    req.on('response', function (res) {
        var bufferHelper = new bufferhelper();
        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        }).on('end', function () {
            var result = iconv.decode(bufferHelper.toBuffer(), 'GBK');
            var $ = cheerio.load(result);
            var key = 0, value;
            var dataList = {};
            $('.H').each(function (index, el) {
                findBottom(index, el);
            });
            $('.B').each(function (index, el) {
                findBottom(index, el);
            });

            function findBottom(index, el) {
                if ($(el.children).length == 6) {
                    key++;
                    value = "相应的比例分别是 \n" + $(el.children).eq(1).text() + "% " + $(el.children).eq(2).text() + "% " + $(el.children).eq(3).text() + "% " + $(el.children).eq(4).text() + "% " + $(el.children).eq(5).text() + "%";
                    dataList[key] = value;
                }
                if ($(el.children).length == 7) {
                    key++;
                    value = "在你修过的所有课程里共有 \n" + $(el.children).eq(2).text() + "优秀 " + $(el.children).eq(3).text() + "良好 " + $(el.children).eq(4).text() + "中等 " + $(el.children).eq(5).text() + "及格 " + $(el.children).eq(6).text() + "不及格";
                    dataList[key] = value;
                }
            }

            callback(dataList);
            console.log(dataList);
        });
    });
}

// 学生成绩(入参20141为学年(2014)加学期(1))，入参为学期编号、session和回调函数
function getStudentScore(term, session, callback) {
    var req = request.post({
        url: hostWithHead + gUrl.termlyScoreURL,
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Connection': "Keep-Alive",
            'Host': host,
            'Cookie': session
        },
        form: {
            sel_xnxq: term,
            radCx: '1',
            btn_search: '检索'
        }
    }, function (err, res, body) {
        if (err) return console.log(err);
    });

    req.on('response', function (res) {
        var bufferHelper = new bufferhelper();
        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        }).on('end', function () {
            var result = iconv.decode(bufferHelper.toBuffer(), 'GBK');
            var $ = cheerio.load(result);
            var dataList = {};
            var key = 0, value;
            $('.H').each(function (index, el) {
                var tempString = $(el.children).eq(0).text();
                //去掉课程编码
                tempString = tempString.substring(8, tempString.length);
                key = key + 1;
                value = tempString + " " + ($(el.children).eq(1).text()) + " " + ($(el.children).eq(6).text());
                if (key && value)
                    dataList[key] = value;
            });
            $('.B').each(function (index, el) {
                var tempString = $(el.children).eq(0).text();
                //去掉课程编码
                tempString = tempString.substring(8, tempString.length);
                key = key + 2;
                value = tempString + " " + ($(el.children).eq(1).text()) + " " + ($(el.children).eq(6).text());
                if (key && value)
                    dataList[key] = value;
            });
            // 打印成绩
            console.log(dataList);
            callback(dataList);
        });
    });
}

// 新进入的用户，捆绑openId和session，入参为用户名称和回复用的对象res
function bindSessionAndOpenId(userName, res) {
    request.get({
        url: hostWithHead + gUrl.termlyScoreURL,
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Host': host
        }
    }, function (err, response, body) {
        if (err) return console.error(err);
        if (response.statusCode == '200') {
            var session = response.headers['set-cookie']; //获取set-cookie字段值

            var newUser = new User({
                userId: '',
                password: '',
                openId: userName,
                session: session,
                validateTime: ''
            });
            newUser.save();
            res.reply("您还没有绑定教务网帐号，回复'绑定 学号 密码'来绑定");
        }
    })
}

// 发送登录请求，入参为验证码、用户文档和回复用的对象res
function postLoginData(validateCode, user, reqx) {
    request.get({
        url: hostWithHead + "/jwmis/_data/home_login.aspx",
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Host': host
        }
    }, function (err, response, body) {
        if (err) return console.error(err);
        if (response.statusCode == '200') {
            var $ = cheerio.load(body);
            var viewState = $("input").first().val();
            var req = request.post({
                    url: hostWithHead + "/jwmis/_data/home_login.aspx",
                    headers: {
                        'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
                        'Referer': hostWithHead + "/jwmis/_data/home_login.aspx",
                        'Cookie': user.session,
                        'Connection': "Keep-Alive",
                        'Host': host
                    },
                    form: {
                        __VIEWSTATE: viewState,
                        pcInfo: "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; .NET CLR 3.5.30729; .NET CLR 2.0.50727; .NET CLR 3.0.30729; rv:11.0) like Geckoundefined5.0 (Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; .NET CLR 3.5.30729; .NET CLR 2.0.50727; .NET CLR 3.0.30729; rv:11.0) like Gecko SN:NULL",
                        typeName: "学生",
                        dsdsdsdsdxcxdfgfg: md5(user.userId + md5(user.password).substring(0, 30).toUpperCase() + '11347').substring(0, 30).toUpperCase(),
                        fgfggfdgtyuuyyuuckjg: md5(md5(validateCode.substring(0, 4).toUpperCase()).substring(0, 30).toUpperCase() + '11347').substring(0, 30).toUpperCase(),
                        Sel_Type: "STU",
                        txt_asmcdefsddsd: user.userId
                    }
                },
                function (err, response, body) {
                    if (err) return console.error(err);
                }
            );
            req.on('response', function (res) {
                var bufferHelper = new bufferhelper();
                res.on('data', function (chunk) {
                    bufferHelper.concat(chunk);
                }).on('end', function () {
                    var result = iconv.decode(bufferHelper.toBuffer(), 'GBK');
                    var $ = cheerio.load(result);
                    var loginStatus = $('#divLogNote').text();
                    console.log(loginStatus);
                    if (!loginStatus.indexOf('正在')) {
                        User.update({openId: user.openId}, {$set: {validateTime: Date.now()}}, function (err, x) {
                            if (err) return console.error(err);
                            console.log('登陆成功');
                            reqx.reply('登录成功');
                        });
                    } else if (!loginStatus.indexOf('验证码')) {
                        console.log('验证码错误！');
                        reqx.reply('验证码错误！');
                    } else if (!loginStatus.indexOf('帐号或密码')) {
                        console.log('帐号或密码错误！');
                        reqx.reply("帐号或密码错误！请回复'解绑'来重新绑定教务网帐号和密码！");
                    } else {
                        console.log('教务网崩了！');
                        reqx.reply('教务网崩了！');
                    }
                });
            });
        }
    });
}

// 更新登录有效期，在用户每一下成功的查询操作后都对validateTime进行更新
function updateValidateTime(user) {
    User.update({openId: user.openId}, {$set: {validateTime: Date.now()}}, function (err, x) {
        if (err) return console.error(err);
    });
}

// 下载验证码，入参为用户文档以及回复用的对象res
function downloadValidateCode(user, res) {
    request.get({
        url: hostWithHead + gUrl.termlyScoreURL,
        headers: {
            'User-Agent': "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
            'Host': host
        }
    }, function (err, response, body) {
        if (err) console.error(err);
        if (response.statusCode == '200') {
            var sessionId = response.headers['set-cookie']; //获取set-cookie字段值

            User.update({openId: user.openId}, {$set: {session: sessionId}}, function (err, x) {
                if (err) return console.error(err);
                picUtils.downloadVC(sessionId, function () {
                    res.reply([{
                        title: '回复"验 下图中的验证码"完成登录',
                        description: '登录超时，需要登录重新授权。',
                        picurl: serverWithHead + '/pic/' + sessionId.toString().substring(18, 28) + '.jpg',
                        url: 'http://nich.work'
                    }]);
                });
            });
        }
    });
}

// 绑定教务网前的逻辑模块，s是内容，openId是微信提供的凭证，res是回复用的对象
function parseMessage(s, openId, res) {
    s = s.toString();
    //console.log('openId: ' + openId);
    if (s.indexOf("绑定") != -1) {
        var account = utils.parseUserIdAndPassword(s);
        if (account.userId === undefined || account.password === undefined) {
            res.reply("学号才不是是这样的，应该这样输入'绑定 201211314213 123456'才行！别忘了绑定、学号、密码之间的空格！");
            return;
        }
        User.update({
            openId: openId
        }, {
            $set: {
                userId: account.userId,
                password: account.password
            }
        }, function (err, user) {
            if (err) return console.error(err);
            res.reply("绑定成功，查询成绩请回复'成绩 学期编码'，如查询本学期的成绩'成绩 20160'、上学期成绩'成绩 20151'");
        });
    } else {
        res.reply("您还没有绑定教务网帐号，回复'绑定 学号 密码'来绑定");
    }
}

// 绑定教务网后的逻辑模块，s是内容，user是传过来的用户对象，res是回复用的对象
function parseLoginMessage(s, user, res) {
    s = s.toString().toUpperCase();
    if (s.indexOf("帮助") != -1) {
        res.reply("1.查询成绩请回复'成绩 学期编码'，如查询本学期的成绩'成绩 20130'、上学期成绩'成绩 20141'\n2.查询课表请回复'课表'\n3.查询入学以来的成绩分布请回复'分布'\n4.查询4、6级成绩请回复 'CET'\n5.解绑教务网帐号请回复'解绑'  ")
    } else {
        if (s.indexOf("解绑") != -1) {
            User.update({
                openId: user.openId
            }, {
                $set: {
                    userId: '',
                    password: '',
                    session: '',
                    validateTime: ''
                }
            }, function (err, userAfterUnbind) {
                if (err) return console.error(err);
                console.log('用户解绑,解绑账户为' + user.userId);
                res.reply("成功解绑");
            });
            return;
        }
        if (s.indexOf("验") != -1) {
            // 发送验证码以完成登录
            var code = utils.parseYear(s);
            postLoginData(code, user, res);
            return;
        }
        if (user.validateTime === null || (Date.now() - (user.validateTime).getTime()) / 1000 > 1800) {
            downloadValidateCode(user, res);
            return;
        }
        if (s.indexOf("成绩") != -1) {
            var term = utils.parseYear(s);
            if (term === undefined || term.length != 5 || term.indexOf("2") === -1) {
                res.reply('你输入的格式有问题，查询成绩应该是"成绩 20131"这样的成绩+空格+学年号+学期号的方式。\n学期号的话，上学期为0、下学期为1。')
            } else {
                getStudentScore(term, user.session, function (dataList) {
                    replyData(dataList, res);
                });
                addLog(user, '查询' + term + '的成绩');
                updateValidateTime(user);
            }
        } else if (s.indexOf("CET") != -1) {
            getCetScore(user.session, function (dataList) {
                replyData(dataList, res);
            });
            addLog(user, '查询四六级成绩');
            updateValidateTime(user);
        } else if (s.indexOf("分布") != -1) {
            getAllTimeScoreDistribute(user.session, function (dataList) {
                replyData(dataList, res);
            });
            addLog(user, '查询成绩分布');
            updateValidateTime(user);
        } else if (s.indexOf("课表") != -1) {
            downloadLessonPic(user.session, res, function () {
                res.reply([{
                    title: '仲恺教务',
                    description: '请点击图片来查看详细课表',
                    picurl: serverWithHead + "/kebiao/" + user.session.toString().substring(18, 28) + '.jpg',
                    url: serverWithHead + "/kebiao/" + user.session.toString().substring(18, 28) + '.jpg'
                }]);
            });
            addLog(user, '查询课表');
            updateValidateTime(user);
        } else {
            res.reply("我不懂你说什么，请输入帮助获取帮助...");
        }
    }
}

app.listen(80, gUrl.serverIP, function () {
    console.log('服务器开启~');
});

module.exports = app;