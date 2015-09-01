

var logger=function(config){
	var logging=false
	var level=config.debugLevel
	if(config.logging)
		logging=config.logging.split(':')
	if(!logging){
		return {
			log:function(){},
			error:console.error
		}
	}
	else{
		return {
			log:function(msg,lvl,target){
				if(logging.indexOf(target)!=-1 && lvl>=level){
					console.log('['+target+'] '+msg);
				}
			},
			error:console.error	
		}
	}
}




















module.exports=logger