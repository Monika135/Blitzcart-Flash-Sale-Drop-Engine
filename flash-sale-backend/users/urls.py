from django.urls import path
from .views import SignupView, LoginView, AllUsersView

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('', AllUsersView.as_view(), name='all-users'),
]
