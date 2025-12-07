# Python Testing with pytest

## Basic Test Structure

```python
import pytest
from myapp.services import UserService

class TestUserService:
    def test_create_user_with_valid_data(self):
        # Arrange
        service = UserService()
        user_data = {"email": "test@example.com", "name": "Test User"}

        # Act
        user = service.create_user(user_data)

        # Assert
        assert user.id is not None
        assert user.email == "test@example.com"

    def test_create_user_with_invalid_email_raises_error(self):
        service = UserService()

        with pytest.raises(ValidationError, match="Invalid email"):
            service.create_user({"email": "invalid", "name": "Test"})
```

## Fixtures

```python
import pytest
from sqlalchemy import create_engine

@pytest.fixture
def db_session():
    """Provide a transactional database session."""
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.rollback()
    session.close()

@pytest.fixture
def user_service(db_session):
    """Provide UserService with test database."""
    return UserService(db_session)

# Usage - fixtures injected automatically
def test_find_user(user_service, db_session):
    user = User(email="test@example.com")
    db_session.add(user)
    db_session.commit()

    found = user_service.find_by_email("test@example.com")
    assert found.id == user.id
```

## Parametrized Tests

```python
@pytest.mark.parametrize("age,expected", [
    (17, False),
    (18, True),
    (21, True),
    (0, False),
    (-1, False),
])
def test_is_adult(age, expected):
    assert is_adult(age) == expected

@pytest.mark.parametrize("email", [
    "user@example.com",
    "user.name@example.co.uk",
    "user+tag@example.com",
])
def test_valid_emails(email):
    assert validate_email(email) is True
```

## Mocking

```python
from unittest.mock import Mock, patch, AsyncMock

def test_send_notification(mocker):
    # Mock external service
    mock_email = mocker.patch("myapp.services.email_client")
    mock_email.send.return_value = True

    service = NotificationService()
    result = service.send_welcome_email("user@example.com")

    assert result is True
    mock_email.send.assert_called_once_with(
        to="user@example.com",
        template="welcome"
    )

# Async mocking
@pytest.mark.asyncio
async def test_fetch_user(mocker):
    mock_client = mocker.patch("myapp.api.http_client")
    mock_client.get = AsyncMock(return_value={"id": 1, "name": "Test"})

    user = await fetch_user(1)
    assert user["name"] == "Test"
```

## pytest Configuration

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
```
