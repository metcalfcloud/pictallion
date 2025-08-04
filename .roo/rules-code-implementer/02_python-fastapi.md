# Python / FastAPI Conventions

* Use `SQLModel` for ORM; `Alembic` for migrations.
* Dependency injection via `fastapi.Depends`.
* Response models inherit from Pydantic `BaseModel` with `model_config = {"from_attributes": True}`.
* Async endpoints only (`async def`).
* Every new endpoint gets:
  * happy‑path test,
  * auth / permission test,
  * error‑path test,
  * OpenAPI example in docstring.