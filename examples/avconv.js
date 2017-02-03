#!/usr/bin/env node

module.exports={
	commandLine:process.env.HOME+'/libav/avconv -i @@ -f null -',
	debug:false,
	env:{ //env that is passed to the spawned target. __workDir__ will be replaced with current workDir for each spawned instance
		ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=__workDir__' //Default ASAN_OPTIONS. NOTE: Do not remove "coverage_dir=__workDir__"
	},
	fileExtension:'av',
	filesPerRound:200,
	inputDirectory:process.env.HOME+'/samples/samples-libav/',
	killTimeout:3000,
	maxBlockCount:1,
    radamsaPath:"radamsa",
	resultDirectory:process.env.HOME+'/results/',
	target:'avconv',
	tempDirectory:'/run/shm/tmp/',
	testCaseGenerators:[
        __dirname+'/../testcasegenerators/surku.js',
        __dirname+'/../testcasegenerators/radamsa.js'
    ]
};
