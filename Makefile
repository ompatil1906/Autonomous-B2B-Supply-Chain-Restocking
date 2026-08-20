.PHONY: install install-backend install-frontend run-backend run-frontend test demo-happy demo-failure clean

install: install-backend install-frontend

install-backend:
	uv sync

install-frontend:
	cd frontend && npm install

run-backend:
	uv run uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

test:
	uv run pytest backend/tests -v

demo-happy:
	uv run python scripts/demo.py --scenario happy

demo-failure:
	uv run python scripts/demo.py --scenario failure

clean:
	rm -rf .venv frontend/node_modules frontend/dist backend/data