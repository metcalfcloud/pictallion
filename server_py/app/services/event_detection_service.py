"""
Event Detection Service

Detects events in photos based on their taken date, including:
- Holidays (US, UK, and other countries)
- Birthdays of people in the database
- Custom user-defined events

Provides age calculation for people in photos and manages holiday settings.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.database import get_async_session
from ..models.person import Person
from ..models.event import Event
from ..models.setting import Setting

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class EventMatch:
    """Represents a detected event match for a photo date"""
    event_id: str
    event_name: str
    event_type: str  # "holiday", "birthday", "custom"
    confidence: int  # 0-100
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    age: Optional[int] = None  # For birthdays

@dataclass
class HolidayDefinition:
    """Defines a holiday with its date and metadata"""
    name: str
    month: int  # 1-12
    day: int    # 1-31
    country: str = "US"
    region: Optional[str] = None

@dataclass
class HolidaySet:
    """Represents available holiday sets"""
    code: str
    name: str
    count: int

# US Holiday definitions
US_HOLIDAYS: List[HolidayDefinition] = [
    HolidayDefinition("New Year's Day", 1, 1, "US"),
    HolidayDefinition("Martin Luther King Jr. Day", 1, 15, "US"),  # Third Monday approximation
    HolidayDefinition("Presidents' Day", 2, 19, "US"),  # Third Monday approximation
    HolidayDefinition("Memorial Day", 5, 27, "US"),  # Last Monday approximation
    HolidayDefinition("Independence Day", 7, 4, "US"),
    HolidayDefinition("Labor Day", 9, 2, "US"),  # First Monday approximation
    HolidayDefinition("Columbus Day", 10, 14, "US"),  # Second Monday approximation
    HolidayDefinition("Veterans Day", 11, 11, "US"),
    HolidayDefinition("Thanksgiving", 11, 28, "US"),  # Fourth Thursday approximation
    HolidayDefinition("Christmas Day", 12, 25, "US"),
    HolidayDefinition("Christmas Eve", 12, 24, "US"),
    HolidayDefinition("New Year's Eve", 12, 31, "US"),
    HolidayDefinition("Valentine's Day", 2, 14, "US"),
    HolidayDefinition("St. Patrick's Day", 3, 17, "US"),
    HolidayDefinition("Easter", 4, 12, "US"),  # Approximate, Easter varies
    HolidayDefinition("Mother's Day", 5, 12, "US"),  # Second Sunday approximation
    HolidayDefinition("Father's Day", 6, 16, "US"),  # Third Sunday approximation
    HolidayDefinition("Halloween", 10, 31, "US"),
]

# UK/International holidays
UK_HOLIDAYS: List[HolidayDefinition] = [
    HolidayDefinition("New Year's Day", 1, 1, "UK"),
    HolidayDefinition("Good Friday", 4, 10, "UK"),  # Approximate, varies
    HolidayDefinition("Easter Monday", 4, 13, "UK"),  # Approximate, varies
    HolidayDefinition("May Day", 5, 1, "UK"),
    HolidayDefinition("Spring Bank Holiday", 5, 27, "UK"),  # Last Monday
    HolidayDefinition("Summer Bank Holiday", 8, 26, "UK"),  # Last Monday
    HolidayDefinition("Christmas Day", 12, 25, "UK"),
    HolidayDefinition("Boxing Day", 12, 26, "UK"),
]

class EventDetectionService:
    """Service for detecting events in photos based on their taken date"""
    
    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
    
    async def detect_events(self, photo_date: datetime) -> List[EventMatch]:
        """
        Detect events in a photo based on its taken date
        
        Args:
            photo_date: The date the photo was taken
            
        Returns:
            List of detected event matches
        """
        matches = []
        
        try:
            # Get enabled holiday settings
            enabled_countries = await self._get_enabled_holiday_countries()
            
            # Check for holiday matches
            holiday_matches = self._detect_holidays(photo_date, enabled_countries)
            matches.extend(holiday_matches)
            
            # Check for birthday matches
            birthday_matches = await self._detect_birthdays(photo_date)
            matches.extend(birthday_matches)
            
            # Check for custom events
            custom_matches = await self._detect_custom_events(photo_date)
            matches.extend(custom_matches)
            
            self.logger.info(f"Detected {len(matches)} events for date {photo_date.date()}")
            return matches
            
        except Exception as e:
            self.logger.error(f"Error detecting events: {e}")
            return []
    
    def _detect_holidays(self, photo_date: datetime, enabled_countries: List[str]) -> List[EventMatch]:
        """
        Detect holiday matches for a given date
        
        Args:
            photo_date: The date to check
            enabled_countries: List of enabled country codes
            
        Returns:
            List of holiday event matches
        """
        matches = []
        month = photo_date.month
        day = photo_date.day
        
        # Get all relevant holidays
        all_holidays = []
        if 'US' in enabled_countries:
            all_holidays.extend(US_HOLIDAYS)
        if 'UK' in enabled_countries:
            all_holidays.extend(UK_HOLIDAYS)
        
        for holiday in all_holidays:
            # Clean holiday name for event_id
            clean_name = holiday.name.lower().replace(' ', '_').replace("'", '').replace('.', '')
            # Exact date match
            if holiday.month == month and holiday.day == day:
                matches.append(EventMatch(
                    event_id=f"holiday_{clean_name}",
                    event_name=holiday.name,
                    event_type="holiday",
                    confidence=100
                ))
            # Near-match (within 1-2 days for holidays that move)
            elif abs(holiday.day - day) <= 2 and holiday.month == month:
                matches.append(EventMatch(
                    event_id=f"holiday_{clean_name}",
                    event_name=holiday.name,
                    event_type="holiday",
                    confidence=80
                ))
        
        return matches
    
    async def _detect_birthdays(self, photo_date: datetime) -> List[EventMatch]:
        """
        Detect birthday matches for a given date
        
        Args:
            photo_date: The date to check
            
        Returns:
            List of birthday event matches
        """
        matches = []
        
        try:
            async with get_async_session() as session:
                # Get all people with birthdates
                stmt = select(Person).where(Person.birthdate.isnot(None))
                result = await session.execute(stmt)
                people = result.scalars().all()
                
                month = photo_date.month
                day = photo_date.day
                year = photo_date.year
                
                for person in people:
                    if not person.birthdate:
                        continue
                    
                    birth_month = person.birthdate.month
                    birth_day = person.birthdate.day
                    
                    # Exact birthday match
                    if birth_month == month and birth_day == day:
                        age = year - person.birthdate.year
                        
                        matches.append(EventMatch(
                            event_id=f"birthday_{person.id}",
                            event_name=f"{person.name}'s Birthday",
                            event_type="birthday",
                            confidence=100,
                            person_id=person.id,
                            person_name=person.name,
                            age=age
                        ))
                    # Near birthday (within 2 days)
                    elif birth_month == month and abs(birth_day - day) <= 2:
                        age = year - person.birthdate.year
                        
                        matches.append(EventMatch(
                            event_id=f"birthday_{person.id}",
                            event_name=f"{person.name}'s Birthday",
                            event_type="birthday",
                            confidence=75,
                            person_id=person.id,
                            person_name=person.name,
                            age=age
                        ))
                
                return matches
                
        except Exception as e:
            self.logger.error(f"Error detecting birthdays: {e}")
            return []
    
    async def _detect_custom_events(self, photo_date: datetime) -> List[EventMatch]:
        """
        Detect custom events for a given date
        
        Args:
            photo_date: The date to check
            
        Returns:
            List of custom event matches
        """
        matches = []
        
        try:
            async with get_async_session() as session:
                # Get all enabled events
                stmt = select(Event).where(Event.is_enabled == True)
                result = await session.execute(stmt)
                events = result.scalars().all()
                
                target_date = photo_date.date()
                
                for event in events:
                    if not event.date:
                        continue
                    
                    event_date = event.date
                    
                    if event.is_recurring and event.recurring_type == 'yearly':
                        # For yearly recurring events, check same month/day in photo year
                        check_date = date(photo_date.year, event_date.month, event_date.day)
                    else:
                        check_date = event_date
                    
                    # Check if dates match (within 1 day tolerance)
                    time_diff = abs((target_date - check_date).days)
                    
                    if time_diff <= 1:
                        confidence = 100 if time_diff == 0 else 85
                        
                        matches.append(EventMatch(
                            event_id=event.id,
                            event_name=event.name,
                            event_type=event.type or "custom",
                            confidence=confidence,
                            person_id=event.person_id
                        ))
                
                return matches
                
        except Exception as e:
            self.logger.error(f"Error detecting custom events: {e}")
            return []
    
    def calculate_age_in_photo(self, birthdate: date, photo_date: datetime) -> Optional[int]:
        """
        Calculate age of a person in a photo based on photo date and birthdate
        
        Args:
            birthdate: Person's birth date
            photo_date: Date the photo was taken
            
        Returns:
            Age in years, or None if invalid
        """
        try:
            if not birthdate or not photo_date:
                return None
            
            photo_date_only = photo_date.date() if isinstance(photo_date, datetime) else photo_date
            
            if photo_date_only < birthdate:
                return None  # Can't be negative age
            
            age = photo_date_only.year - birthdate.year
            
            # Adjust if birthday hasn't occurred yet in the photo year
            if (photo_date_only.month < birthdate.month or 
                (photo_date_only.month == birthdate.month and photo_date_only.day < birthdate.day)):
                age -= 1
            
            return age
            
        except Exception as e:
            self.logger.error(f"Error calculating age: {e}")
            return None
    
    async def initialize_default_holidays(self) -> None:
        """Initialize default holiday settings if they don't exist"""
        try:
            async with get_async_session() as session:
                # Check if holiday settings exist
                stmt = select(Setting).where(Setting.key == 'enabled_holidays')
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()
                
                if not existing:
                    # Create default holiday settings
                    setting = Setting(
                        key='enabled_holidays',
                        value='["US"]',
                        category='events',
                        description='Enabled holiday country sets for event detection'
                    )
                    session.add(setting)
                    await session.commit()
                    self.logger.info("Initialized default holiday settings")
                    
        except Exception as e:
            self.logger.error(f"Error initializing holiday settings: {e}")
    
    def get_available_holiday_sets(self) -> List[HolidaySet]:
        """
        Get available holiday country options
        
        Returns:
            List of available holiday sets with metadata
        """
        return [
            HolidaySet(code='US', name='United States', count=len(US_HOLIDAYS)),
            HolidaySet(code='UK', name='United Kingdom', count=len(UK_HOLIDAYS)),
        ]
    
    async def _get_enabled_holiday_countries(self) -> List[str]:
        """
        Get enabled holiday countries from settings
        
        Returns:
            List of enabled country codes
        """
        try:
            async with get_async_session() as session:
                stmt = select(Setting).where(Setting.key == 'enabled_holidays')
                result = await session.execute(stmt)
                setting = result.scalar_one_or_none()
                
                if setting and setting.value:
                    import json
                    return list(json.loads(setting.value))
                else:
                    return ['US']  # Default to US holidays
                    
        except Exception as e:
            self.logger.error(f"Error getting enabled holiday countries: {e}")
            return ['US']  # Default fallback

# Singleton instance
event_detection_service = EventDetectionService()