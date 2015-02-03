# covFuzz

covFuzz is coverage analysis tool (and fuzzer). 

Idea in covFuzz is similar to afl( http://lcamtuf.coredump.cx/afl/ ), but covFuzz allows
user defined fuzzers, and instead of custom compiler it uses ASanCoverage( https://code.google.com/p/address-sanitizer/wiki/AsanCoverage ) for coverage data.