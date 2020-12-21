.PHONY: demo sane

demo: sane
	make node_modules
	npm start

sane:
	[ -x "$(shell command -v brew)" ] # see: https://brew.sh
	# minimum requirements tested: NodeJS LTS (currently v14)
	[ -x "$(shell command -v npm)" ] || brew install yarn
	[ -x "$(shell command -v blink1-tool)" ] || brew install blink1
	# check for Leap Motion or warn if background applications (us) won't work
	#[ -d /Applications/Blink1Control2.app ] || brew install --cask blink1control
	#curl http://localhost:8934/blink/id # to check that debug server can connect
	[ -x "$(shell command -v sox)" ] || brew install sox # for baudio: play, etc.

node_modules: package.json
	npm install
