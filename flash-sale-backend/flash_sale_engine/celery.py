import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "flash_sale_engine.settings")

app = Celery("flash_sale_engine")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()