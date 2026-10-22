from django.urls import re_path

from .consumers import FileSyncConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/rooms/(?P<code>[A-Za-z0-9]+)/files/(?P<file_id>\d{1,12})/$",
        FileSyncConsumer.as_asgi(),
    ),
]