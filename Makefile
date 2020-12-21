.PHONY: demo sane

demo: sane
	make node_modules
	npm start

sane:
	[ -x "$(shell command -v brew)" ] # see: https://brew.sh
	[ -x "$(shell command -v npm)" ] || brew install yarn
	# minimum requirements tested: old NodeJS LTS (currently ^12)
	[ -x "$(shell command -v blink1-tool)" ] || brew install blink1
	# check for Leap Motion or warn if background applications (us) won't work
	[ -d /Applications/Blink1Control2.app ] || brew install --cask blink1control
	# for now, we're using HTTP to signal the LED(s), but that's not the best way
	curl http://localhost:8934/blink1/id # to check that debug server can connect
	# the sox package lets baudio play sound through the MBP's speakers
	[ -x "$(shell command -v sox)" ] || brew install sox

node_modules: package.json
	npm install
