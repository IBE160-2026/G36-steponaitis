"""ASGI entrypoint: uvicorn swp.main:app."""

from swp.api.app import create_app

app = create_app()
