'use strict';

module.exports = function(quick) {
    var exports = {};
    var shell = require('shelljs');
    var fs = require('fs');
    var exists = fs.existsSync;
    var path = require('path');
    var prompt = require('prompt');
    var moment = require('moment');

    var Promise = quick.util.Promise;
    //var $base = settings.baseFolder;
    var settings = quick.config;
    var $buildFolder = settings.build.path;
    var $buildFilterFolder = settings.build.filter || /^(node_modules|jquery|seajs|logs)$/i;
    var $logsFolder = path.resolve('..',settings.logFileFolder);
    var $conf = settings.build.confs;

    var $isStart = false; // 是否开始构建
    var $versions = [];
    var $dirs = [];

    exports.start = function(){

        Promise.try(function() {
            quick.log.ok('用户设定待构建目录：');
            quick.log.writeln('\t'+$buildFolder+'\n');
            quick.log.ok('开始拷贝构建配置文件到待构建目录...');
            return new Promise(function(resolve, reject) {
                var len = $conf.length;
                var temparr = [];

                for(var l=0;l<len;l++){
                    var temp = $conf.shift();
                    if(temp!='' && temp!=undefined){
                        var filepath =  temp;
                        var buildpath =  path.resolve($buildFolder, path.basename(temp));
                        //在构建配置文件目录存在，但在构建目标目录不存在，则需要copy过去
                        if (exists(filepath)) {
                            if(!exists(buildpath)){
                                temparr.push(filepath);
                            }
                        }else{
                            quick.log.error('\n构建配置文件'+filepath+'不存在！');
                        }
                    }
                }
                shell.cp('-rf', temparr, $buildFolder+'/');
                quick.log.ok('构建配置文件已拷贝到待构建目录。');
                resolve();

            }).then(function(){
                    quick.log.ok('\n准备开始执行构建 ...');
                    quick.log.debug('\n用户设定待构建目录:'+ $buildFolder);
                    shell.cd($buildFolder);
                    quick.log.debug('\n进入待构建目录 '+ $buildFolder);
                });
        }).then(function(){

            quick.log.debug("replace path.resolve('node_modules') to path.resolve('..', 'node_modules')");
            shell.sed('-i', "path.resolve('node_modules')", "path.resolve('..', 'node_modules')", "node_modules/grunt/lib/grunt/task.js");
            if( !shell.test('-d', $logsFolder) ){
                shell.mkdir($logsFolder);
                quick.log.ok('创建了日志目录 '+ $logsFolder);
            }
            //获取目标构建目录的可构建组件名称数组
            $dirs = exports.findModuleList($buildFolder);

            quick.log.ok('\n可构建的组件列表，共 '+$dirs.length+' 个组件：');
            quick.log.writeln('\n\t'+$dirs.join(' | ').bold.yellow)
            //询问式构建开始
            exports.main();
        });

    };

    exports.findModuleList = function(buildpath){
        shell.cd(buildpath);
        //quick.log.ok('当前目录 ');
        //quick.log.writeln('\t'+buildpath);
        return shell.ls('./').filter(function(file) {
            // 仅返回目录，并且过滤掉 node_modules 和 module-tpl 两个非组件目录
            // 以及其他一些特殊组件
            return !$buildFilterFolder.test(file) && shell.test('-d', file);
        });
    };

    //构建循环逻辑
    exports.main = function(welocme){

        prompt.message = '[' + '?'.green + ']';
        prompt.delimiter = ' ';

        quick.log.success((welocme || '\n请输入要构建的模块名')+'\t[全部构建请输入 all]:\n');

        prompt.start();

        var options = {
            properties:{
                name: {
                    message: 'Module name',
                    validator: /^[\w\-]+$/,
                    warning: 'Must be only letters, numbers, dashes or underscores.'
                }
            }
        };

        prompt.get(options,function (err, result) {
            var $cmd = result.name;

            if ( $dirs.length ) {
                if ( $cmd === "all") {
                    quick.log.debug('all');
                } else if ( shell.test('-d', $cmd) ) {
                    $dirs = [$cmd];
                } else {
                    quick.log.error('\n输入错误或组件名不存在\n');
                    exports.main('请重新输入要构建的模块名');
                    return;
                }

                shell.echo('\n');
                quick.log.ok('待构建队列：',$dirs.join(', '));
                quick.log.ok('即将开始，共 '+$dirs.length+' 个组件');
                Promise.try(function() {
                    exports.run($dirs);
                });
            } else {
                shell.echo('\n没有可以构建的组件\n');
            }
        });
    };

    /***
     * 运行构建逻辑
     * @param dirs 需要构建的组件文件夹
     */
    exports.run = function(dirs){
        var name, version, pkgpath;
        if( dirs.length ){
            if( $isStart ) {
                shell.echo('\n');
                quick.log.ok('还有 '+ dirs.length + ' 个组件等待构建...');
                shell.echo('\n');
            }
            $isStart = true;
            name = dirs.shift();
            pkgpath = path.join($buildFolder,name,'package.json');

            quick.log.debug("\n找到package配置文件:"+pkgpath);

            version = quick.util.pkg('version', pkgpath);

            shell.echo('\n当前是 '+name + '@' + version +'\n');

            $versions.push( '"'+name+'": ["'+ version +'"]');

            shell.cd($buildFolder);//回到构建文件夹

            if ( name !== 'seajs' ) {
                // seajs 需要使用自己的构建文件
                shell.cp('-f', 'Gruntfile.js', name+'/');
            }

            shell.cd(name);

            shell.exec('grunt', function(code, output) {
                // 疑问 2013-04-11
                // 仅执行 grunt 命令，可以得到完整的 output 内容
                // 执行 grunt jshint 或 grunt qunit 就可不到完整的 output 内容，为什么？

                if( output.indexOf('without errors') === -1 ){
                    (output).to(path.join($logsFolder,name+'.log'));
                }else{
                    exports.run(dirs);
                }
            });
        }else{
            fs.appendFile(path.join($logsFolder,'version.txt'), moment().format('llll')+'\t'+$versions+'\n');
            quick.log.ok('构建完毕.');
            quick.log.ok('本次构建日志文件存放在： '+ $logsFolder);
            quick.log.writeln();
            /*var temp = $conf.length;
             for(var i = 0; i<temp;i++){
             console.log($conf);
             shell.rm('-rf', path.join($buildFolder,$conf[i]));
             shell.echo("已删除:"+path.join($buildFolder,$conf[i]));
             }*/
            //shell.exit(1);
        }
    };

    return exports;
};