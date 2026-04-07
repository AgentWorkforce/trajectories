.PHONY: dev build clean kill

dev:
	@sh launch.sh &

build:
	@swift build

clean:
	@swift package clean

kill:
	@pkill -f TrailViewer 2>/dev/null || true
	@pkill -f "tsx src/server" 2>/dev/null || true
	@echo "All Trail Viewer processes stopped"
