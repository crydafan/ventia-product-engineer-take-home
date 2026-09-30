from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.core.database import Base
from app.models import order  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name == "business"
    return parent_names.get("schema_name") == "business"


def configure_context(**kwargs):
    context.configure(
        target_metadata=Base.metadata,
        include_schemas=True,
        include_name=include_name,
        version_table="business_alembic_version",
        version_table_schema="public",
        **kwargs,
    )


def run_migrations_offline() -> None:
    configure_context(
        url=settings.database_url,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        configure_context(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
