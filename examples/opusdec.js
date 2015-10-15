
module.exports={
	debug:false,
	fileExtension:'opus',
	killTimeout:3000,
	maxBlockCount:1,
	inputDirectory:process.env.HOME+'/samples/samples-svg/',
	resultDirectory:process.env.HOME+'/results/',
	target:'opusdec',
	commandLine:process.env.HOME+'/point-n-click/packages/opus-tools/opusdec @@ /dev/null',
	tempDirectory:'/run/shm/tmp/'
}
