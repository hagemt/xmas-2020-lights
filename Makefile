.PHONY: demo sane

demo: sane
	make node_modules
	npm start
.PHONY: demo

sane:
	@# if this doesn't work, we just need to install Brew first:
	[ -x "$(shell command -v brew)" ] # see: https://brew.sh
	# the sox package will let baudio play sound through the MBP's speakers
	[ -x "$(shell command -v sox)" ] || brew install sox
	# the yarn package depends upon NodeJS and its standard package MGMT tooling
	[ -x "$(shell command -v npm)" ] || brew install yarn
	# minimum requirements tested: old NodeJS LTS (currently ^12)
	[ -x "$(shell command -v blink1-tool)" ] || brew install blink1
	# check for Leap Motion or warn if background applications (us) won't work
	[ -d /Applications/Blink1Control2.app ] || brew install --cask blink1control
	# for now, we're using HTTP to signal the LED(s), but there are other ways
	# open the Blink1Control2.app's Preferences and tick "Start API server"
	# if this doesn't seem to work right away:
	-curl http://localhost:8934/blink1/id
.PHONY: sane

test: sane
	make node_modules
	npm test
.PHONY: test

node_modules: package.json
	npm install
