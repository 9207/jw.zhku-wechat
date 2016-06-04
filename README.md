仲恺微信教务查询
==
基于Node.js，通过微信订阅号查课程成绩的一个小玩意
### Usage
在机器上安装[Node.js](https://nodejs.org/en/) 4.0+，[MongoDB](https://www.mongodb.com/) 3.0+

于app.js中配置微信appid、token和encodingAESKey，服务器地址

配置微信公众号服务器地址

然后于命令行中执行
```
npm install

node app
```

### Dependencies
* [Express](https://github.com/expressjs/express)
* [wechat](https://github.com/node-webot/wechat)
* [bufferhelper](https://github.com/JacksonTian/bufferhelper)
* [cheerio](https://github.com/cheeriojs/cheerioola/HotFix)
* [iconv-lite](https://github.com/ashtuchkin/iconv-lite)
* [md5](https://github.com/pvorb/node-md5)
* [mongoose](https://github.com/Automattic/mongoose)
* [request](https://github.com/request/request)

### License
[MIT](https://github.com/9207/jw.zhku-wechat/blob/master/LICENSE)