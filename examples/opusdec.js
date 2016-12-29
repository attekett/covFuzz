#!/usr/bin/env node

module.exports={
    commandLine:process.env.HOME+'/opus-tools/opusdec @@ /dev/null',
    debug:false,
    env:{

        ASAN_OPTIONS:'coverage=1:coverage_dir=\'__workDir__\''

    },
    fileExtension:'opus',
    filesPerRound:200,
    inputDirectory:process.env.HOME+'/samples/samples-opus/',
    killTimeout:3000,
    maxBlockCount:1,
    radamsaPath:"radamsa",
    resultDirectory:process.env.HOME+'/results/',
    target:'opusdec',
    tempDirectory:'/run/shm/tmp/',
    testCaseGenerators:[
        __dirname+'/../testcasegenerators/surku.js',
        __dirname+'/../testcasegenerators/radamsa.js'
    ]
};
