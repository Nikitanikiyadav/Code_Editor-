from django.urls import path
from rest_framework.routers import SimpleRouter

from .file_views import (
    FileDetailView,
    FileListCreateView,
    FileSaveView,
    VersionDetailView,
    VersionListView,
)
from .views import RoomViewSet

router = SimpleRouter()
router.register("rooms", RoomViewSet, basename="room")

urlpatterns = router.urls + [
    path("rooms/<str:code>/files/", FileListCreateView.as_view()),
    path("rooms/<str:code>/files/<int:file_id>/", FileDetailView.as_view()),
    path("rooms/<str:code>/files/<int:file_id>/save/", FileSaveView.as_view()),
    path("rooms/<str:code>/files/<int:file_id>/versions/", VersionListView.as_view()),
    path(
        "rooms/<str:code>/files/<int:file_id>/versions/<int:version_id>/",
        VersionDetailView.as_view(),
    ),
]