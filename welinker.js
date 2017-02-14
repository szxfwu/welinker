
var welinker = (function () {

    var socketOpenCounter = 0;   //socket系统连接的计数器
    var sysLoginCounter = 0;  //登录系统业务的计数器
    var sysLoginState = false;  //是否有登录业务系统状态，必须登录才能操作其于业务
    var socketOpenState = false;   //是否成功连接socket状态
    var socket = null;

    var websocket_callBack;
    var dataCacheList = [];   //数据缓存
    var errorCounter = 0;  //解析数据异常次数  超过一定次数后会清楚数据
    var sysLoginSessionid = 0;  //本次登录系统的id
    
    var loginKey = '25EFDE0F7E244147A9218C4F508E6E13';  //key 在www.welinker.net 网站注册帐号申请
    function connectSocket() {

        var t1 = 0;
        var t2 = 0;

        var szServer = "wss://sk.szousheng.com";  //设备云连接地址
        try {
            if (!("WebSocket" in window) && !("MozWebSocket" in window)) {
                return false;
            };
            if (("MozWebSocket" in window)) {
                socket = new MozWebSocket(szServer);
            } else {
                socket = new WebSocket(szServer);
            };

        } catch (e) {
            console.log("socket connect error:" + JSON.stringify(e));
        };
        //邦定事件
        socket.onopen = function (event) {
            socketOpenState = true;
            sysLogin();
            websocket_callBack("Login", 0, "");

        }
        socket.onclose = function (event) {
            if (socket.close() != null) {
                socket = null;
            }
            socketOpenState = false;
            sysLoginState = false;
            websocket_callBack("Login", 1, "");
        }
        socket.onerror = function (event) {
            socketOpenState = false;
            sysLoginState = false;
            websocket_callBack("Login", 1, "");
        }
        socket.onmessage = function (evt) {
            t2 = new Date().getTime();

            if (typeof (evt.data) == "string") {
                console.log("收到字符串：" + JSON.parse(evt.data));
            } else {
                var reader = new FileReader();
                reader.onload = function (evt) {
                    if (evt.target.readyState == FileReader.DONE) {
                        var data = new Uint8Array(evt.target.result);
                        //console.log("abc data:" + JSON.stringify(data));
                        WxOnMessage(data, (t2 - t1));
                    }
                }
                reader.readAsArrayBuffer(evt.data);

            }

        }
        //end 邦定事件结束

    };


    function WxOnMessage(result, nTime) {

        var data = new Uint8Array(result);
        for (var d = 0; d < data.length; d++) {
            dataCacheList.push(data[d]);
        }
        var b = dataCacheList.length;
        for (; b > 0;) {
            //解析方法
            b = DataAnalysis(dataCacheList);

            if (b == 0) {//如果返回值是是0 计数据加1
                errorCounter++;
            } else {//清除解析完的数据
                dataCacheList.splice(0, b); //从开头清除所解析掉的长度
            }
            if (errorCounter > 5) {//清除所有缓存数据
                errorCounter = 0;
                dataCacheList.splice(0, dataCacheList.length);
            }
        }
    }


    //数据解析函数
    function DataAnalysis(resData) {

        if (resData[1] != 111) {
            console.log("无效数据");
            return 0;
        }

        var topic = "";
        for (var i = 2; i < resData.length; i++) {
            if (resData[i] == 0)
                break;
            topic += String.fromCharCode(resData[i]);
        }
        //  cmd+topic+0
        var Length = 2 + topic.length + 1;
        var MsgLength = 0;

        //数据长度  得到具体返回的用户数据
        MsgLength |= resData[Length] << 8;
        MsgLength |= resData[Length + 1] << 0;

        //  cmd+topic+0+len
        Length = Length + 2;  //+len
        var dataLength = 0;
        dataLength = Length + MsgLength;//本次总解析的长度。。
        //从length 开始  复制数据到dataLength
        var ResultData = resData.slice(Length, dataLength);

        var errno = 0;

        errno |= ResultData[4] << 24;
        errno |= ResultData[5] << 16;
        errno |= ResultData[6] << 8;
        errno |= ResultData[7] << 0;
        //errno 状态表示
        //#define SBC_ERR_OK           0
        //#define SBC_ERR_NOTHING     -1
        //#define SBC_ERR_NODEVICE    -2
        //#define SBC_ERR_LOCKED      -3
        //#define SBC_ERR_TIMEOUT     -4
        //#define SBC_ERR_INTASK      -5
        //#define SBC_ERR_CRC         -6
        //#define SBC_ERR_APPKEY      -7
        //#define SBC_ERR_INVARG      -8
        //#define SBC_ERR_NOMEM       -9
        //#define SBC_ERR_ISSLAVE     -10
        //#define SBC_ERR_OUTSERVICE  -11
        //#define SBC_ERR_UNKNOW      -12
        //#define SBC_ERR_OFFLINE     -13

        switch (topic) {

            case "/phoneAPI/1.10/Longin": {

                var sessionid = 0;

                sessionid |= ResultData[8] << 56;
                sessionid |= ResultData[9] << 48;
                sessionid |= ResultData[10] << 40;
                sessionid |= ResultData[11] << 32;
                sessionid |= ResultData[12] << 24;
                sessionid |= ResultData[13] << 16;
                sessionid |= ResultData[14] << 8;
                sessionid |= ResultData[15] << 0;

                sysLoginSessionid = sessionid;

                if (errno == 0) {
                    //登录成功
                    sysLoginState = true;
                    websocket_callBack("Login", errno, ResultData);

                }
                break;
            }
            case "/phoneAPI/1.10/GetThingStatus": {
                websocket_callBack("DeviceStatus", errno, ResultData);

                break;
            }
            case "/phoneAPI/1.10/DeviceWrite": {
                websocket_callBack("DeviceWrite", errno, ResultData);
                break;
            }
            case "/phoneAPI/1.10/DeviceRead": {
                websocket_callBack("DeviceRead", errno, ResultData);
                break;
            }
            case "/phoneAPI/1.10/DeviceAutoRead": {
                websocket_callBack("DeviceAutoRead", errno, ResultData);
                break;
            }
        }
        return dataLength;
    }


    //注册用户的回调方法
    function CallBack_onMessage(callback) {
        websocket_callBack = callback;
    }


    function sysLogin() {

        var cmd = cmdWrite.Login();
        if (socketOpenState === true) {
            socket.send(cmd)
        }
    }

    //对外公布的方法。让页面端调用
    function deviceControl(thid, deviceid, returnNum, returnWait, data) {

        if (socketOpenState === true) {
            var cmd = cmdWrite.DeviceWrite(thid, deviceid, returnNum, returnWait, data);

            t1 = new Date().getTime();
            socket.send(cmd);
        }
    };
    function deviceRead(thid, deviceid, timeout) {

        if (socketOpenState === true) {
            var cmd = cmdWrite.DeviceRead(thid, deviceid, timeout);
            t1 = new Date().getTime();
            socket.send(cmd);
        }
    }
    function deviceAutoRead(thid, deviceid, identity) {
        if (socketOpenState === true) {
            var cmd = cmdWrite.DeviceAutoRead(thid, deviceid, identity);
            t1 = new Date().getTime();
            socket.send(cmd);
        }
    }
    function getThingStatus(thidList) {
        if (socketOpenState === true) {
            var cmd = cmdWrite.GetThingStatus(thidList);
            t1 = new Date().getTime();
            socket.send(cmd);
        }
    }
    function deviceAutoWrite(thid, deviceid, identity, returnNum, returnWait, data) {
        if (socketOpenState === true) {
            var cmd = cmdWrite.DeviceAutoWrite(thid, deviceid, identity, returnNum, returnWait, data);
            t1 = new Date().getTime();
            socket.send(cmd);
        }
    }
    function monitorExecution() {
        Calculator();//调用计数器
        //判断是否有连接
        if (socket == null || socketOpenState == false) {
            if (socketOpenCounter > 500) {
                connectSocket();
                socketOpenCounter = 0; //每成功调用一次。重新计数
            }
        }
        //业务
        //判断系统是否登录 
        if (socketOpenState && !sysLoginState) {
            if (sysLoginCounter > 500) {
                sysLogin();
                sysLoginCounter = 0;  //每成功调用一次。重新计数
            }
        }
    }

    function Calculator() {
        //socket 连接计数器自动加
        socketOpenCounter += 100;
        sysLoginCounter += 100;
        //业务  系统登录计数器自动加

    }
    var cmdWrite = {
        Login: function () {  //系统登录
            var topic = '/phoneAPI/1.10/Longin';
            
            var length = 2 + topic.length + 1 + 2 + 4 + loginKey.length + 1 + 8;

            var out = new ArrayBuffer(length);

            var u8a = new Uint8Array(out);

            var strs = topic.split("");
            var o = 0;
            u8a[o++] = 0x0;
            u8a[o++] = 111;

            for (var k = 0; k < strs.length; k++) {
                u8a[o++] = strs[k].charCodeAt();
            }
            u8a[o++] = 0x0;
            var msgLength = 4 + loginKey.length + 1 + 8;
            u8a[o++] = (msgLength >> 8) & 0xff;
            u8a[o++] = msgLength & 0xff;


            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;

            var KeyStrs = loginKey.split("");
            for (var k = 0; k < KeyStrs.length; k++) {
                u8a[o++] = KeyStrs[k].charCodeAt();
            }
            u8a[o++] = 0x0;
            //sessionid
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;


            return out;
        },
        GetThingStatus: function (thidList) { // //获取状态命令编写
            var topic = '/phoneAPI/1.10/GetThingStatus';
            var length = 2 + topic.length + 1 + 2 + 4 + 2 + (thidList.length * 8);
            var out = new ArrayBuffer(length);
            var u8a = new Uint8Array(out);
            var strs = topic.split("");
            var o = 0;
            u8a[o++] = 0;
            u8a[o++] = 111;
            for (var k = 0; k < strs.length; k++) {
                u8a[o++] = strs[k].charCodeAt();
            }
            u8a[o++] = 0x000;

            var msgLength = 4 + 2 + (thidList.length * 8);
            u8a[o++] = (msgLength >> 8) & 0xff;
            u8a[o++] = msgLength & 0xff;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;

            msgLength = thidList.length;  //thid个数

            u8a[o++] = (msgLength >> 8) & 0xff;
            u8a[o++] = msgLength & 0xff;

            for (var k = 0; k < thidList.length; k++) {

                for (var b = 0; b < thidList[k].length; b += 2) {
                    u8a[o++] = parseInt(thidList[k].substr(b, 2), 16);
                }
            }

            return out;
        },
        DeviceWrite: function (thid, deviceid, returnNum, returnWait, data) {   //写入命令
            // console.log("data length:" + data.length + " ,data info:" + JSON.stringify(data));

            var topic = '/phoneAPI/1.10/DeviceWrite';
            var length = 2 + topic.length + 1 + 2 + 4 + 8 + 4 + 2 + 4 + 2 + data.length;

            var out = new ArrayBuffer(length);
            var u8a = new Uint8Array(out);
            var strs = topic.split("");

            try {
                var o = 0;
                u8a[o++] = 0;
                u8a[o++] = 111;
                for (var k = 0; k < strs.length; k++) {
                    u8a[o++] = strs[k].charCodeAt();
                }
                u8a[o++] = 0;
                //len
                var msglength = 4 + 8 + 4 + 2 + 4 + 2 + data.length;
                u8a[o++] = (msglength >> 8) & 0xff;
                u8a[o++] = msglength & 0xff;
                //msg

                u8a[o++] = 0x00;
                u8a[o++] = 0x00;
                u8a[o++] = 0x00;
                u8a[o++] = 0x00;

                for (var k = 0; k < thid.length; k += 2) {
                    u8a[o++] = parseInt(thid.substr(k, 2), 16);
                }

                u8a[o++] = (deviceid >> 24) & 0xff;
                u8a[o++] = (deviceid >> 16) & 0xff;
                u8a[o++] = (deviceid >> 8) & 0xff;
                u8a[o++] = deviceid & 0xff;

                u8a[o++] = (returnNum >> 8) & 0xff;
                u8a[o++] = returnNum & 0xff;

                u8a[o++] = (returnWait >> 24) & 0xff;
                u8a[o++] = (returnWait >> 16) & 0xff;
                u8a[o++] = (returnWait >> 8) & 0xff;
                u8a[o++] = returnWait & 0xff;

                var dataLength = data.length;
                u8a[o++] = (dataLength >> 8) & 0xff;
                u8a[o++] = dataLength & 0xff;

                for (var k = 0; k < data.length; k++) {
                    u8a[o++] = data[k];
                }

            } catch (e) {

                console.log("cmmandWrite>>try catch:" + e);
            }
            console.log("O的长度：" + o + "<--->要求长度：" + length);
            return out;
        },
        DeviceRead: function (thid, deviceid, timeout) {//单个读取命令

            var topic = '/phoneAPI/1.10/DeviceRead';
            var length = 2 + topic.length + 1 + 2 + 4 + 8 + 4 + 4;
            var out = new ArrayBuffer(length);
            var u8a = new Uint8Array(out);
            var strs = topic.split("");
            var o = 0;
            u8a[o++] = 0;
            u8a[o++] = 111;
            for (var k = 0; k < strs.length; k++) {
                u8a[o++] = strs[k].charCodeAt();
            }
            u8a[o++] = 0;
            var msgLength = 4 + 8 + 4 + 4;
            u8a[o++] = (msgLength >> 8) & 0xff;
            u8a[o++] = msgLength & 0xff;

            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;

            for (var k = 0; k < thid.length; k += 2) {
                u8a[o++] = parseInt(thid.substr(k, 2), 16);
            }

            u8a[o++] = (deviceid >> 24) & 0xff;
            u8a[o++] = (deviceid >> 16) & 0xff;
            u8a[o++] = (deviceid >> 8) & 0xff;
            u8a[o++] = deviceid & 0xff;

            u8a[o++] = (timeout >> 24) & 0xff;
            u8a[o++] = (timeout >> 16) & 0xff;
            u8a[o++] = (timeout >> 8) & 0xff;
            u8a[o++] = timeout & 0xff;

            return out;
        },
        DeviceAutoRead: function (thid, deviceid, identity) {  //读取命令
            var topic = '/phoneAPI/1.10/DeviceAutoRead';

            var length = 2 + topic.length + 1 + 2 + 4 + 8 + 4 + identity.length + 1;
            var out = new ArrayBuffer(length);
            var u8a = new Uint8Array(out);
            var strs = topic.split("");
            var o = 0;
            u8a[o++] = 0;
            u8a[o++] = 111;
            for (var k = 0; k < strs.length; k++) {
                u8a[o++] = strs[k].charCodeAt();
            }
            u8a[o++] = 0;

            var msgLength = 4 + 8 + 4 + identity.length + 1;

            u8a[o++] = (msgLength >> 8) & 0xff;
            u8a[o++] = msgLength & 0xff;

            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;

            for (var k = 0; k < thid.length; k += 2) {
                u8a[o++] = parseInt(thid.substr(k, 2), 16);
            }

            u8a[o++] = (deviceid >> 24) & 0xff;
            u8a[o++] = (deviceid >> 16) & 0xff;
            u8a[o++] = (deviceid >> 8) & 0xff;
            u8a[o++] = deviceid & 0xff;

            var IdenStrs = identity.split("");
            for (var k = 0; k < identity.length; k++) {
                u8a[o++] = IdenStrs[k].charCodeAt();
            }

            u8a[o++] = 0x00;

            return out;
        },
        DeviceAutoWrite: function (thid, deviceid, identity, returnNum, returnWait, data) {
            var topic = '/phoneAPI/1.10/DeviceAutoWrite';

            var length = 2 + topic.length + 1 + 2 + 4 + 8 + 4 + identity.length + 1 + 2 + 4 + 2 + data.length;

            var out = new ArrayBuffer(length);
            var u8a = new Uint8Array(out);
            var strs = topic.split("");
            var o = 0;
            u8a[o++] = 0;
            u8a[o++] = 111;
            for (var k = 0; k < strs.length; k++) {
                u8a[o++] = strs[k].charCodeAt();
            }
            u8a[o++] = 0;

            var msgLength = 4 + 8 + 4 + identity.length + 1 + 2 + 4 + 2 + data.length;

            u8a[o++] = (msgLength >> 8) & 0xff;
            u8a[o++] = msgLength & 0xff;

            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;
            u8a[o++] = 0x00;

            for (var k = 0; k < thid.length; k += 2) {
                u8a[o++] = parseInt(thid.substr(k, 2), 16);
            }

            u8a[o++] = (deviceid >> 24) & 0xff;
            u8a[o++] = (deviceid >> 16) & 0xff;
            u8a[o++] = (deviceid >> 8) & 0xff;
            u8a[o++] = deviceid & 0xff;

            var IdenStrs = identity.split("");
            for (var k = 0; k < identity.length; k++) {
                u8a[o++] = IdenStrs[k].charCodeAt();
            }

            u8a[o++] = 0x00;

            u8a[o++] = (returnNum >> 8) & 0xff;
            u8a[o++] = returnNum & 0xff;

            u8a[o++] = (returnWait >> 24) & 0xff;
            u8a[o++] = (returnWait >> 16) & 0xff;
            u8a[o++] = (returnWait >> 8) & 0xff;
            u8a[o++] = returnWait & 0xff;

            var dataLength = data.length;
            u8a[o++] = (dataLength >> 8) & 0xff;
            u8a[o++] = dataLength & 0xff;

            for (var k = 0; k < data.length; k++) {
                u8a[o++] = data[k];
            }
            return out;

        }

    };

    //一加载就创建连接
    connectSocket();
    setInterval(monitorExecution, 300);  //300毫秒检查一次连接状态
    //定义外部可以调用的方法
    return {
        ConnectSocket: connectSocket,
        CallBackonMessage: CallBack_onMessage,
        DeviceControl: deviceControl,
        DeviceAutoRead: deviceAutoRead,
        DeviceRead: deviceRead,
        DeviceStatus: getThingStatus,
        DeviceAutoWrite: deviceAutoWrite
    };

}(welinker || {}));
