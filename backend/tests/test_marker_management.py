
import pytest
from unittest.mock import Mock, AsyncMock
from infrastructure.repositories.subspace_repo import SubspaceRepository

@pytest.fixture
def mock_client():
    client = Mock()
    # Mock schema().from_()... chain
    client.schema.return_value = client
    client.from_.return_value = client
    client.select.return_value = client
    client.insert.return_value = client
    client.delete.return_value = client
    client.eq.return_value = client
    client.execute.return_value = Mock(data=[])
    return client

@pytest.mark.asyncio
async def test_add_marker(mock_client):
    repo = SubspaceRepository(mock_client)
    mock_client.execute.return_value = Mock(data=[{'id': 1}])

    success = await repo.add_marker(subspace_id=10, marker_id=20)
    
    assert success is True
    # Verify chain
    mock_client.schema.assert_called_with('misir')
    mock_client.from_.assert_called_with('subspace_marker')
    mock_client.insert.assert_called_with({
        'subspace_id': 10,
        'marker_id': 20,
        'weight': 1.0,  # default
        'source': 'user_defined' # default
    })

@pytest.mark.asyncio
async def test_remove_marker(mock_client):
    repo = SubspaceRepository(mock_client)
    mock_client.execute.return_value = Mock(data=[{'subspace_id': 10}])
    
    success = await repo.remove_marker(subspace_id=10, marker_id=20)
    
    assert success is True
    mock_client.from_.assert_called_with('subspace_marker')
    mock_client.delete.assert_called()
    # Check filters
    # Call args list on .eq(): [call('subspace_id', 10), call('marker_id', 20)]
    assert mock_client.eq.call_count == 2
    args_list = mock_client.eq.call_args_list
    assert args_list[0][0] == ('subspace_id', 10)
    assert args_list[1][0] == ('marker_id', 20)

@pytest.mark.asyncio
async def test_get_markers(mock_client):
    repo = SubspaceRepository(mock_client)
    expected_data = [{'marker_id': 20, 'weight': 0.8}]
    mock_client.execute.return_value = Mock(data=expected_data)
    
    results = await repo.get_markers(subspace_id=10)
    
    assert results == expected_data
    mock_client.from_.assert_called_with('subspace_marker')
    mock_client.select.assert_called_with('weight, source, marker:marker_id(id, label, embedding)')
    mock_client.eq.assert_called_with('subspace_id', 10)
