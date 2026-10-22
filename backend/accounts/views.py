from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Profile
from .serializers import (
    LoginSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """React calls this once so the browser receives the csrftoken cookie."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"detail": "CSRF cookie set"})


@method_decorator(csrf_protect, name="dispatch")  # always require CSRF token
class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"  # rate limit, see settings

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)  # returns 400 with messages if invalid
        user = serializer.save()
        login(request, user)  # log them in right after registering
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            # Same message for "wrong user" and "wrong password" on purpose,
            # so attackers can't discover which usernames exist.
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)  # creates the session
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    # Default permission is IsAuthenticated, so only logged-in users reach this.
    def post(self, request):
        logout(request)  # deletes the session
        return Response({"detail": "Logged out."})


class MeView(APIView):
    """GET: who am I?   PATCH: update my profile."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user

        if "email" in data:
            email = data["email"].strip().lower()
            taken = type(user).objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
            if taken:
                return Response(
                    {"email": ["This email is already used."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.email = email
            user.save()

        if "bio" in data:
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.bio = data["bio"]
            profile.save()

        user.refresh_from_db()
        return Response(UserSerializer(user).data)