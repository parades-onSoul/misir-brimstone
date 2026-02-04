"""
Configuration Validation and Drift Detection Testing.

Validates system configuration and provides tools for testing drift detection thresholds.
"""
import asyncio
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

from infrastructure.repositories.base import get_supabase_client
from supabase import Client

logger = logging.getLogger(__name__)


@dataclass
class SystemConfigValidation:
    """Result of system configuration validation."""
    is_valid: bool
    errors: list[str]
    warnings: list[str]
    config: Dict[str, Any]


@dataclass 
class DriftTestResult:
    """Result of drift detection testing."""
    subspace_id: int
    baseline_centroid: list[float]
    test_drift_magnitude: float
    threshold: float
    would_trigger: bool
    velocity_observed: Optional[float]


class ConfigValidator:
    """Validates and tests system configuration for production readiness."""
    
    REQUIRED_CONFIG_KEYS = [
        'embedding_model',
        'reading_depth_constants', 
        'centroid_history_threshold',
        'vector_index_params',
        'assignment_margin_threshold'
    ]
    
    def __init__(self, client: Client = None):
        self._client = client or get_supabase_client()
    
    async def validate_system_config(self) -> SystemConfigValidation:
        """
        Validate all system configuration for production readiness.
        
        Returns:
            SystemConfigValidation with errors and warnings
        """
        errors = []
        warnings = []
        config = {}
        
        try:
            loop = asyncio.get_event_loop()
            
            def query_config():
                response = (
                    self._client.schema('misir')
                    .from_('system_config')
                    .select('key, value, description')
                    .execute()
                )
                return {row['key']: row['value'] for row in (response.data or [])}
            
            config = await loop.run_in_executor(None, query_config)
            
            # Check required keys
            for key in self.REQUIRED_CONFIG_KEYS:
                if key not in config:
                    errors.append(f"Missing required config key: {key}")
                    continue
                
                # Validate specific configurations
                if key == 'embedding_model':
                    self._validate_embedding_config(config[key], errors, warnings)
                elif key == 'reading_depth_constants':
                    self._validate_reading_depth_config(config[key], errors, warnings)
                elif key == 'centroid_history_threshold':
                    self._validate_centroid_threshold_config(config[key], errors, warnings)
                elif key == 'assignment_margin_threshold':
                    self._validate_margin_config(config[key], errors, warnings)
            
            # Check for deprecated or unknown configs
            known_keys = set(self.REQUIRED_CONFIG_KEYS + [
                'vector_index_params'  # Optional but known
            ])
            for key in config.keys():
                if key not in known_keys:
                    warnings.append(f"Unknown config key: {key}")
            
            is_valid = len(errors) == 0
            
            logger.info(f"Config validation: {'PASSED' if is_valid else 'FAILED'} "
                       f"({len(errors)} errors, {len(warnings)} warnings)")
            
            return SystemConfigValidation(
                is_valid=is_valid,
                errors=errors,
                warnings=warnings,
                config=config
            )
            
        except Exception as e:
            logger.error(f"Failed to validate system config: {e}")
            return SystemConfigValidation(
                is_valid=False,
                errors=[f"Validation failed: {e}"],
                warnings=[],
                config={}
            )
    
    def _validate_embedding_config(self, config: Dict[str, Any], errors: list, warnings: list):
        """Validate embedding model configuration."""
        required_fields = ['name', 'dimension', 'context_length']
        for field in required_fields:
            if field not in config:
                errors.append(f"embedding_model missing field: {field}")
        
        if 'dimension' in config:
            dim = config['dimension']
            if not isinstance(dim, int) or dim < 256 or dim > 8192:
                errors.append(f"Invalid embedding dimension: {dim} (must be 256-8192)")
        
        if 'name' in config:
            model_name = config['name']
            if 'nomic-ai' in model_name and config.get('dimension') != 768:
                warnings.append(f"Nomic models typically use 768 dimensions, got {config.get('dimension')}")
    
    def _validate_reading_depth_config(self, config: Dict[str, Any], errors: list, warnings: list):
        """Validate reading depth constants."""
        required_fields = ['avg_wpm', 'time_weight', 'scroll_weight', 'max_ratio']
        for field in required_fields:
            if field not in config:
                errors.append(f"reading_depth_constants missing field: {field}")
        
        if 'time_weight' in config and 'scroll_weight' in config:
            total_weight = config['time_weight'] + config['scroll_weight']
            if abs(total_weight - 1.0) > 0.01:  # Allow small float precision errors
                warnings.append(f"time_weight + scroll_weight = {total_weight}, should sum to 1.0")
        
        if 'avg_wpm' in config:
            wpm = config['avg_wpm']
            if wpm < 100 or wpm > 500:
                warnings.append(f"avg_wpm of {wpm} seems unusual (typical range: 150-300)")
    
    def _validate_centroid_threshold_config(self, config: Dict[str, Any], errors: list, warnings: list):
        """Validate centroid history threshold configuration."""
        required_fields = ['distance_threshold', 'min_signals_between_logs']
        for field in required_fields:
            if field not in config:
                errors.append(f"centroid_history_threshold missing field: {field}")
        
        if 'distance_threshold' in config:
            threshold = config['distance_threshold']
            if threshold <= 0 or threshold > 1:
                errors.append(f"Invalid distance_threshold: {threshold} (must be 0-1)")
            elif threshold < 0.01 or threshold > 0.2:
                warnings.append(f"distance_threshold of {threshold} may cause too much/little logging")
    
    def _validate_margin_config(self, config: Any, errors: list, warnings: list):
        """Validate assignment margin threshold."""
        try:
            threshold = float(config)
            if threshold <= 0 or threshold > 1:
                errors.append(f"assignment_margin_threshold must be 0-1, got {threshold}")
            elif threshold < 0.05 or threshold > 0.3:
                warnings.append(f"assignment_margin_threshold of {threshold} may be too restrictive/permissive")
        except (ValueError, TypeError):
            errors.append(f"assignment_margin_threshold must be a number, got {type(config)}")
    
    async def test_drift_detection(
        self, 
        subspace_id: int,
        user_id: str,
        simulate_drift: bool = False
    ) -> Optional[DriftTestResult]:
        """
        Test drift detection on a specific subspace.
        
        Args:
            subspace_id: Subspace to test
            user_id: Owner of the subspace
            simulate_drift: If True, simulate a drift event
            
        Returns:
            DriftTestResult or None if subspace not found
        """
        try:
            loop = asyncio.get_event_loop()
            
            # Get subspace details
            def query_subspace():
                response = (
                    self._client.schema('misir')
                    .from_('subspace')
                    .select('centroid_embedding')
                    .eq('id', subspace_id)
                    .eq('user_id', user_id)
                    .execute()
                )
                return response.data[0] if response.data else None
            
            subspace = await loop.run_in_executor(None, query_subspace)
            if not subspace or not subspace['centroid_embedding']:
                logger.warning(f"Subspace {subspace_id} not found or has no centroid")
                return None
            
            baseline_centroid = subspace['centroid_embedding']
            
            # Get drift threshold from config
            config_validation = await self.validate_system_config()
            threshold = config_validation.config.get('centroid_history_threshold', {}).get('distance_threshold', 0.05)
            
            # Calculate test drift (either simulate or get recent velocity)
            if simulate_drift:
                # Simulate 10% drift (should trigger if threshold < 0.1)
                test_drift = 0.1
                would_trigger = test_drift >= threshold
                velocity = None
            else:
                # Get recent velocity data
                velocity = await self._get_recent_velocity(subspace_id)
                test_drift = velocity or 0.0
                would_trigger = test_drift >= threshold
            
            logger.info(f"Drift test for subspace {subspace_id}: "
                       f"drift={test_drift:.4f}, threshold={threshold:.4f}, "
                       f"would_trigger={would_trigger}")
            
            return DriftTestResult(
                subspace_id=subspace_id,
                baseline_centroid=baseline_centroid,
                test_drift_magnitude=test_drift,
                threshold=threshold,
                would_trigger=would_trigger,
                velocity_observed=velocity
            )
            
        except Exception as e:
            logger.error(f"Failed to test drift detection: {e}")
            return None
    
    async def _get_recent_velocity(self, subspace_id: int) -> Optional[float]:
        """Get most recent velocity measurement for a subspace."""
        try:
            loop = asyncio.get_event_loop()
            
            def query_velocity():
                response = (
                    self._client.schema('misir')
                    .from_('subspace_velocity')
                    .select('velocity')
                    .eq('subspace_id', subspace_id)
                    .order('measured_at', desc=True)
                    .limit(1)
                    .execute()
                )
                return response.data[0]['velocity'] if response.data else None
            
            return await loop.run_in_executor(None, query_velocity)
            
        except Exception as e:
            logger.error(f"Failed to get recent velocity: {e}")
            return None
    
    async def get_drift_analytics_summary(self, user_id: str, days: int = 7) -> Dict[str, Any]:
        """
        Get drift analytics summary for user's subspaces.
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Summary statistics
        """
        try:
            loop = asyncio.get_event_loop()
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            def query_analytics():
                # Get drift events
                drift_response = (
                    self._client.schema('misir')
                    .from_('subspace_drift')
                    .select('subspace_id, drift_magnitude, occurred_at, subspace!inner(user_id)')
                    .eq('subspace.user_id', user_id)
                    .gte('occurred_at', cutoff_date.isoformat())
                    .execute()
                )
                
                # Get velocity measurements  
                velocity_response = (
                    self._client.schema('misir')
                    .from_('subspace_velocity')
                    .select('subspace_id, velocity, measured_at, subspace!inner(user_id)')
                    .eq('subspace.user_id', user_id)
                    .gte('measured_at', cutoff_date.isoformat())
                    .execute()
                )
                
                return {
                    'drifts': drift_response.data or [],
                    'velocities': velocity_response.data or []
                }
            
            data = await loop.run_in_executor(None, query_analytics)
            
            # Calculate summary stats
            drifts = data['drifts']
            velocities = data['velocities']
            
            summary = {
                'period_days': days,
                'drift_events': len(drifts),
                'avg_drift_magnitude': sum(d['drift_magnitude'] for d in drifts) / len(drifts) if drifts else 0,
                'max_drift_magnitude': max((d['drift_magnitude'] for d in drifts), default=0),
                'velocity_measurements': len(velocities),
                'avg_velocity': sum(v['velocity'] for v in velocities) / len(velocities) if velocities else 0,
                'max_velocity': max((v['velocity'] for v in velocities), default=0),
                'active_subspaces': len(set(d['subspace_id'] for d in drifts + velocities))
            }
            
            logger.info(f"Drift analytics for user {user_id}: {summary}")
            return summary
            
        except Exception as e:
            logger.error(f"Failed to get drift analytics: {e}")
            return {'error': str(e)}