#!/usr/bin/env node

module.exports={
	commandLine:process.env.HOME+'/jsoncpp/build/debug/src/jsontestrunner/jsontestrunner_exe --json-checker @@',
	debug:false,
    env:{
        ASAN_OPTIONS:'coverage=1:coverage_dir=\'__workDir__\''
    },
    fileExtension:'json',
    filesPerRound:200,
    inputDirectory:process.env.HOME+'/samples/samples-json/',
    killTimeout:3000,
    maxBlockCount:1,
    radamsaPath:"radamsa",
    resultDirectory:process.env.HOME+'/results/',
    target:'jsoncpp',
    tempDirectory:'/run/shm/tmp/',
    testCaseGenerators:[
        __dirname+'/../testcasegenerators/surku.js',
        __dirname+'/../testcasegenerators/radamsa.js'
    ]
};
