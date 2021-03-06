const url = require("url");

const fs = require("fs");
const path = require("path");
const { constants } = require("buffer");

function walkSync(currentDirPath, bindToObject) {
    var fs = require('fs'),
        path = require('path');
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            bindToObject[path.basename(filePath, '.js')] = require(filePath);
        } else if (stat.isDirectory()) {
            let varname = filePath.split(path.sep).pop();
            // console.log(varname);
            bindToObject[varname] = {};
            walkSync(filePath, bindToObject[varname]);
        }
    });
}


class App {
    route_maps = {

    };
    module_s = {};
    globalData = {
        $service: {

        }
    };
    $runtime = {
        inits: [],
        middlewares: []
    }
    constructor() {

    }
    responseJson(res, data) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(JSON.stringify(data));
    }

    apiSuccess(res, data = {}) {

        this.responseJson(res, {
            code: 1,
            msg: "成功",
            data: data
        })
    }
    apiError(res, msg, code = 0, data = {}) {
        this.responseJson(res, {
            code: code,
            msg: msg,
            data: data
        })
    }
    module(name, baseDir) {
        if (arguments.length == 1) {
            name = "epii-app";
            baseDir = arguments[0]
        }
        if (!fs.existsSync(baseDir)) {
            console.log(baseDir + "is not exist");
        }

        if (name.indexOf("/") === 0) {
            name = name.substr(1);
        }
        this.module_s["/" + name] = {
            dir: baseDir,
            apps: {

            },
            name:"/" + name
        }
        return this;
    }
    init(callback) {
        this.$runtime.inits.push(callback);
        return this;
    }
    use(callback) {
        this.$runtime.middlewares.push(callback.bind(this.globalData));
        return this;
    }
    service(name, object) {
        if (!this.globalData.$service.hasOwnProperty(name)) {
            this.globalData.$service[name] = object;
        } else {
            Object.assign(this.globalData.service[name], object);
        }
        return this;
    }
    serviceDir(serviceDir) {
        if (fs.existsSync(serviceDir)) {
            walkSync(serviceDir, this.globalData.$service);
        }

        return this;
    }
    findHander(pathname) {
        for (let key in this.route_maps) {

            const reg = new RegExp("^" + key, "i");
            const reg_info = reg.exec(pathname);
            if (reg_info) {

                return { handler: this.route_maps[key], gets: Array.from(reg_info) }
            }
        }
        return null;
    }
    route(path, handler) {
        this.route_maps[path] = (typeof handler === "function") ? handler.bind(this.globalData) : handler;
        return this;
    }
    appHandler(moduleInfo) {
        return {
            handler: (params) => {
                let app_tmp = (params["app"] ? params["app"] : "index@index").split("@");
                if (app_tmp.length == 1) app_tmp[1] = "index";

                if (!moduleInfo.apps.hasOwnProperty(app_tmp[0])) {
                    let file = moduleInfo.dir + "/" + app_tmp[0] + ".js";
                    if (fs.existsSync(file)) {
                        let m = require(file);
                        if (typeof m === "function") {
                            moduleInfo.apps[app_tmp[0]] = m.bind(this.globalData);
                        } else if (typeof m === "object") {

                            m.__proto__ = this.globalData;

                            moduleInfo.apps[app_tmp[0]] = m;
                            if (moduleInfo.apps[app_tmp[0]].init) {
                                moduleInfo.apps[app_tmp[0]].init();
                            }
                        }


                    }
                }

                if (moduleInfo.apps[app_tmp[0]]) {
                    if (typeof moduleInfo.apps[app_tmp[0]] === "function") {
                        return moduleInfo.apps[app_tmp[0]]
                    }
                    if ((typeof moduleInfo.apps[app_tmp[0]] === "object") && moduleInfo.apps[app_tmp[0]].hasOwnProperty(app_tmp[1])) {
                        return moduleInfo.apps[app_tmp[0]][app_tmp[1]].bind(moduleInfo.apps[app_tmp[0]]);
                    }
                }

                return null;

            },
            name:moduleInfo.name
        }
    }
    async callback() {
        let that = this;
        let inits_l = this.$runtime.inits.length;
        for (let i = 0; i < inits_l; i++) {
            await (this.$runtime.inits[i].bind(this.globalData))(this);
        }

        for (let name in this.module_s) {
            this.route(name, this.appHandler(this.module_s[name]))
        }
        return (request, response) => {

            request.setEncoding('utf-8');
            let url_info = url.parse(request.url, true);

            let pathname = url_info.pathname;
 
            let handler = this.findHander(pathname);

 
            if (!handler) {
                this.apiError(response, "没有处理器");
            } else {


                var postData = "";
                // 数据块接收中
                request.on("data", (postDataChunk) => {
                    postData += postDataChunk;
                });

                request.on("end", async () => {

                    var params = {};
                    try {
                        params = JSON.parse(postData.toString());
                    } catch (e) {
                        params = {};
                    }

                    Object.assign(params, url_info.query);

                    for (let i = 0; i < handler.gets.length; i++) {
                        params["$" + i] = handler.gets[i];
                    }
                    params["$$"] = pathname;

                    let handler_object = {

                        req: request,
                        res: response,
                        canNext: true,
                        shareData: {},
                        params(key, dvalue) {

                            if (arguments.length == 0) return params;
                            return params.hasOwnProperty(key) ? params[key] : dvalue;
                        },
                        paramsSet(key, value) {
                            params[key] = value;
                            return this;
                        },
                        success(data) {
                            that.apiSuccess(this.res, data);
                            this.canNext = false;
                        },
                        error(msg = "error", code = 0, data = {}) {
                            that.apiError(this.res, msg, code, data);
                            this.canNext = false;
                        },
                        html(htmlString) {
                            this.req.end(htmlString);
                            this.canNext = false;
                        },
                        content(content) {
                            this.html(content);
                        }

                    };

                    let m_len = this.$runtime.middlewares.length;
                    for (let i = 0; i < m_len; i++) {
                        if (!handler_object.canNext) {
                            return;
                        }
                        await this.$runtime.middlewares[i](handler_object);
                    }

                    handler = handler.handler;
                    if ((typeof handler === "object") && handler.handler) {
                        //判断是否有app
                        if (!params.app) {
                            let app_tmp_s = pathname.replace(handler.name + "/", "").split("/");
                            params.app = app_tmp_s[0] + (app_tmp_s.length > 1 ? ("@" + app_tmp_s[1]) : "");
                        }
                        handler = handler.handler(params);
                    }

                    if (!handler) {
                        this.apiError(response, "没有app处理器");
                        return;
                    }
                    try {
                        let out = await handler(handler_object)
                        if (out !== undefined) {
                            that.apiSuccess(response, out);
                        }
                    } catch (error) {

                        that.apiError(response, typeof error === "string" ? error : error.message);

                    }

                });

            }
        }

    }
  
    async listen(port, httpsOptions) {
        try {
            if (httpsOptions) {
                require("https").createServer(httpsOptions, await this.callback()).listen(port);
            } else
                require("http").createServer(await this.callback()).listen(port);
            console.log("server start at port:" + port)
        } catch (error) {
            console.log(error);
        }

    }
}



module.exports = App;