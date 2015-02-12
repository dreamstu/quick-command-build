'use strict';

exports.name = 'build';
exports.usage = '<names> [options]';
exports.desc = 'build components';

var fs = require('fs');
var path = require('path');
var exists = fs.existsSync;

exports.register = function(commander,quick){

    commander
        .option('-r, --root <path>', 'set build root')
        .option('-f, --force', 'forced to skip warning')
        .action(function(){
            var Promise = quick.util.Promise;

            var args = [].slice.call(arguments);
            var options = args.pop();

            var settings = {
                root: options.root || '',
                force:(options.force)?'--force':''
            };

            Promise.try(function() {
                if (!settings.root) {
                    return quick.util.findConf(function(dir){
                        settings.root = dir || process.cwd();
                    });
                }
            }).then(function(){
                var filepath =  path.resolve(settings.root, quick.config.confFileName);
                if (exists(filepath)) {
                    require(filepath)(quick);
                    if(settings.force!=''){
                        quick.config.build.force=settings.force
                    }
                    require('./lib/build')(quick).start();
                }else{
                    quick.log.error('请检查qconf配置文件是否存在！');
                }
            }).catch(function(e) {
                if (/Not\s+Found/i.test(e.message)) {
                    quick.log.warn('`quick install` now is for installing commponents, you may use `\x1b[31mlights install\x1b[0m` instead.');
                }
                quick.log.error('\x1b[31m%s\x1b[0m', e.message);
            });
        });
};