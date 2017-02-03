#!/usr/bin/env node

module.exports={
	analyzeCoverage:true, //Disable if you want to fuzz target without coverage analysis.
	analyzeOnly:false, //Enable to only analyse sample from inputDirectory and exit without fuzzing.
	binaries:[".*"], //Array of library/binary names from which you want to collect coverate-data from. used in: new RegExp("("+config.binaries.join('|')+").*\.sancov$")
	commandLine:process.env.HOME+'/projects/libav/avconv -i @@ -f null -',//The commandline command that is normally used when starting the target. @@ is replaced with file name.
	debug: false, //Set to enable debugging.
	env:{ //env that is passed to the spawned target. __workDir__ will be replaced with current workDir for each spawned instance
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=__workDir__' //Default ASAN_OPTIONS. NOTE: Do not remove "coverage_dir=__workDir__"
	},
	inputDirectory:process.env.HOME+'/samples/samples-media-cut/',//Directory where samples are read on start.
	instanceCount:1,//How many parallel instances of the target should be executed.
	instrumentationPath:'./src/ASAN.js',//Location for the instrumentation file to be used.
	killSignal:'SIGTERM',//Signal that is used with spawn.kill on timeout
	killTimeout:10000, //Timeout which after the target is killed.
	logging:true, //Logging to file.
	maxBlockCount:1, //How many files per block are collected from the original sample collection. Doesn't effect during fuzzing phase.
	maxTempTestCases:20, //How many fuzzed test cases we are trying to keep on queue at all times.
	maxTestCaseCount:undefined, //Use this if you want to run specific number of test cases. Note that initial samples count to this limit.
	outputDirectory:undefined, //Directory where samples and test cases that give new coverage are written
	resultDirectory:process.env.HOME+'/results/', //Directory where crashes are outputted
	radamsaPath:"radamsa", //Path to radamsa. By default presumes that radamsa is in your path.
	reverse:false, //Normal mode sorts files from smallest to largest, setting this reverses the order.
	target:'target_application', //Name of the target application. Used when writing results
	tempDirectory:'/run/shm/tmp/', //Directory where temps are written. I recommend using a directory that is located on a ramdisk.
	testCaseGenerators:[
		__dirname+'/../testcasegenerators/surku.js',
		__dirname+'/../testcasegenerators/radamsa.js'
	]//Test case generators. Defaults to use radamsa and surku modules included in testcasegenerators directory.
};
