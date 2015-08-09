'use strict';
var fs = require('fs');
var path = require('path');
var core = require('quick-build-core');
module.exports = function(argv) {
    var _ = {};

    var currName = path.basename(process.cwd());

    function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';    
    }

    _.start = function(){
        var build = core({
            printLog:function(){
                console.log(Array.prototype.join.call(arguments,''));
            },
            process:function(name){
                console.log('# 当前已完成：',name);
            },
            done:function(shell){
                console.log('# 已经全部构建完成！');
                shell.exit(-1);
            }
        });
        if(!isArray(argv.queue)){
            if(argv.queue=='all'){
                //获取所有可构建的对象
                build.getQueue(argv.inf,function(err,queue){
                    if(err){
                        console.log('获取队列失败：',err);
                        return;
                    }
                    argv.queue = queue;
                    run(argv);
                });
                return;
            }else{
                argv.queue = [currName];
            }
        }
        //开始任务
        run(argv);

        function run(argv){
            process.setMaxListeners(0);
            build.start({
                root: argv.root,
                tmp: argv.temp,
                inf: argv.inf,//模块目录的上一层
                outf: argv.outf,//目录相对于临时目录中的模块目录，可以使用绝对路径
                queue:argv.queue,
                moreLog:argv.moreLog,
                uglify:argv.uglify,
                id:argv.id,
                clear:argv.clear,
                delay:argv.delay
            });
        }
    }
    return _;
};