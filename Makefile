SERVER      := armmarov@192.168.1.160
FE_REMOTE   := /var/www/stf
BE_REMOTE   := /home/armmarov/Work/stf/be
PM2_APP     := stf-be

LICHESS_URL := https://database.lichess.org/lichess_db_puzzle.csv.zst
CSV_PATH    := backend/prisma/puzzles.csv

.PHONY: help build build-fe build-be \
        fetch-puzzles seed-puzzles \
        deploy deploy-fe deploy-be deploy-csv \
        server-install server-migrate server-build server-seed server-restart server-logs \
        release

help:
	@echo "Local:"
	@echo "  make build            # build FE + BE"
	@echo "  make build-fe         # vue-tsc + vite build"
	@echo "  make build-be         # tsc"
	@echo "  make fetch-puzzles    # download + filter Lichess CSV (1000 @ 1200-1800)"
	@echo "  make seed-puzzles     # run seed script against local DB"
	@echo ""
	@echo "Deploy (one-shot):"
	@echo "  make release          # build -> sync -> migrate -> build-on-server -> restart"
	@echo ""
	@echo "Deploy steps:"
	@echo "  make deploy-fe        # rsync frontend/dist -> $(FE_REMOTE)"
	@echo "  make deploy-be        # rsync backend src -> $(BE_REMOTE)"
	@echo "  make deploy-csv       # rsync puzzles.csv only"
	@echo "  make server-install   # npm ci on server (if package-lock changed)"
	@echo "  make server-migrate   # prisma migrate deploy on server"
	@echo "  make server-build     # tsc on server"
	@echo "  make server-seed      # seed puzzles on server"
	@echo "  make server-restart   # pm2 restart $(PM2_APP)"
	@echo "  make server-logs      # tail pm2 logs"

# ---- Local build ----

build: build-fe build-be

build-fe:
	cd frontend && rm -f .tsbuildinfo && npm run build

build-be:
	cd backend && npm run build

# ---- Puzzle CSV ----

fetch-puzzles:
	@command -v zstd >/dev/null 2>&1 || { echo "zstd required: sudo apt install zstd"; exit 1; }
	@echo "Downloading Lichess puzzle DB (large, ~300MB)..."
	curl -L -o /tmp/puzzles.csv.zst $(LICHESS_URL)
	zstd -d -f /tmp/puzzles.csv.zst -o /tmp/puzzles_full.csv
	@echo "Filtering 1200-1800 rating, 1000 rows..."
	head -1 /tmp/puzzles_full.csv > $(CSV_PATH)
	awk -F',' 'NR>1 && $$4>=1200 && $$4<=1800' /tmp/puzzles_full.csv | shuf -n 1000 >> $(CSV_PATH)
	rm -f /tmp/puzzles.csv.zst /tmp/puzzles_full.csv
	@echo "Wrote $(CSV_PATH): $$(wc -l < $(CSV_PATH)) lines"

seed-puzzles:
	cd backend && npm run seed:puzzles

# ---- Deploy (rsync) ----

deploy-fe: build-fe
	rsync -av --delete frontend/dist/ $(SERVER):$(FE_REMOTE)/

deploy-be:
	rsync -av --delete \
		--exclude node_modules --exclude dist --exclude .env --exclude 'uploads/*' \
		--exclude '*.log' \
		backend/ $(SERVER):$(BE_REMOTE)/

deploy-csv:
	rsync -av $(CSV_PATH) $(SERVER):$(BE_REMOTE)/prisma/

deploy: deploy-fe deploy-be

# ---- Server-side (run via ssh) ----

server-install:
	ssh $(SERVER) 'cd $(BE_REMOTE) && npm ci --omit=dev=false'

server-migrate:
	ssh $(SERVER) 'cd $(BE_REMOTE) && npx prisma migrate deploy && npx prisma generate'

server-build:
	ssh $(SERVER) 'cd $(BE_REMOTE) && npm run build'

server-seed:
	ssh $(SERVER) 'cd $(BE_REMOTE) && npm run seed:puzzles'

server-restart:
	ssh $(SERVER) 'pm2 restart $(PM2_APP) && pm2 save'

server-logs:
	ssh $(SERVER) 'pm2 logs $(PM2_APP) --lines 100 --nostream'

# ---- One-shot release ----
# Full path: build local -> sync both sides -> install/migrate/build on server -> restart.
# Add `seed=1` to also run the puzzle seed: `make release seed=1`
release: build deploy server-install server-migrate server-build server-restart
ifeq ($(seed),1)
	$(MAKE) server-seed
endif
	@echo "---- Deployed. Check https://www.stfchess.com/puzzle ----"
