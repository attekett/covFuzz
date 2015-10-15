

module.exports={
	debug:false,
	killTimeout:3000,
	maxBlockCount:1,
	filesPerRound:200,
	env:{ //env that is passed to the spawned target. __workDir__ will be replaced with current workDir for each spawned instance
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=__workDir__' //Default ASAN_OPTIONS. NOTE: Do not remove "coverage_dir=__workDir__" 
	},
	inputDirectory:process.env.HOME+'/samples/samples-media-cut/',
	resultDirectory:process.env.HOME+'/results/',
	target:'avconv',
	commandLine:process.env.HOME+'/projects/libav/avconv -i @@ -f null -',
	tempDirectory:'/run/shm/tmp/'
}
