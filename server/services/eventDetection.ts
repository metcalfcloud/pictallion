import { storage } from "../storage";
import { type Event, type Person } from "@shared/schema";
import { error } from "@shared/logger";

export interface EventMatch {
  personId?: string;
  personName?: string;
  age?: number; // For birthdays
  confidence?: number; // Event detection confidence
  eventType?: string; // Type of event (holiday, birthday, etc.)
  eventName?: string; // Name of the event
}

export interface HolidayDefinition {
  name: string;
  month: number;
  day: number;
  country?: string;
  region?: string;
}

const US_HOLIDAYS: HolidayDefinition[] = [
  { name: "New Year's Day", month: 1, day: 1, country: "US" },
  { name: "Martin Luther King Jr. Day", month: 1, day: 15, country: "US" }, // Third Monday approximation
  { name: "Presidents' Day", month: 2, day: 19, country: "US" }, // Third Monday approximation
  { name: "Memorial Day", month: 5, day: 27, country: "US" }, // Last Monday approximation
  { name: "Independence Day", month: 7, day: 4, country: "US" },
  { name: "Labor Day", month: 9, day: 2, country: "US" }, // First Monday approximation
  { name: "Columbus Day", month: 10, day: 14, country: "US" }, // Second Monday approximation
  { name: "Veterans Day", month: 11, day: 11, country: "US" },
  { name: "Thanksgiving", month: 11, day: 28, country: "US" }, // Fourth Thursday approximation
  { name: "Christmas Day", month: 12, day: 25, country: "US" },
  { name: "Christmas Eve", month: 12, day: 24, country: "US" },
  { name: "New Year's Eve", month: 12, day: 31, country: "US" },
  { name: "Valentine's Day", month: 2, day: 14, country: "US" },
  { name: "St. Patrick's Day", month: 3, day: 17, country: "US" },
  { name: "Easter", month: 4, day: 12, country: "US" }, // Approximate, Easter varies
  { name: "Mother's Day", month: 5, day: 12, country: "US" }, // Second Sunday approximation
  { name: "Father's Day", month: 6, day: 16, country: "US" }, // Third Sunday approximation
  { name: "Halloween", month: 10, day: 31, country: "US" },
];

const UK_HOLIDAYS: HolidayDefinition[] = [
  { name: "New Year's Day", month: 1, day: 1, country: "UK" },
  { name: "Good Friday", month: 4, day: 10, country: "UK" }, // Approximate, varies
  { name: "Easter Monday", month: 4, day: 13, country: "UK" }, // Approximate, varies
  { name: "May Day", month: 5, day: 1, country: "UK" },
  { name: "Spring Bank Holiday", month: 5, day: 27, country: "UK" }, // Last Monday
  { name: "Summer Bank Holiday", month: 8, day: 26, country: "UK" }, // Last Monday
  { name: "Christmas Day", month: 12, day: 25, country: "UK" },
  { name: "Boxing Day", month: 12, day: 26, country: "UK" },
];

export class EventDetectionService {
  
  /**
   * Detect events in a photo based on its taken date
   */
  async detectEvents(photoDate: Date): Promise<EventMatch[]> {
    const matches: EventMatch[] = [];
    
    try {
      const holidaySettings = await storage.getSettingByKey('enabled_holidays');
      const enabledCountries = holidaySettings?.value ? JSON.parse(holidaySettings.value) : ['US'];
      
      const holidayMatches = this.detectHolidays(photoDate, enabledCountries);
      matches.push(...holidayMatches);
      
      const birthdayMatches = await this.detectBirthdays(photoDate);
      matches.push(...birthdayMatches);
      
      const customMatches = await this.detectCustomEvents(photoDate);
      matches.push(...customMatches);
      
      return matches;
    } catch (err) {
      error('Error detecting events', "EventDetection", { error: err });
      return [];
    }
  }
  
  /**
   * Detect holiday matches for a given date
   */
  private detectHolidays(photoDate: Date, enabledCountries: string[]): EventMatch[] {
    const matches: EventMatch[] = [];
    const month = photoDate.getMonth() + 1; // JavaScript months are 0-indexed
    const day = photoDate.getDate();
    
    const allHolidays = [
      ...(enabledCountries.includes('US') ? US_HOLIDAYS : []),
      ...(enabledCountries.includes('UK') ? UK_HOLIDAYS : []),
    ];
    
    for (const holiday of allHolidays) {
      // Exact date match
      if (holiday.month === month && holiday.day === day) {
        matches.push({
        });
      }
      // Near-match (within 1-2 days for holidays that move)
      else if (Math.abs(holiday.day - day) <= 2 && holiday.month === month) {
        matches.push({
        });
      }
    }
    
    return matches;
  }
  
  /**
   * Detect birthday matches for a given date
   */
  private async detectBirthdays(photoDate: Date): Promise<EventMatch[]> {
    const matches: EventMatch[] = [];
    
    try {
      const people = await storage.getPeople();
      const month = photoDate.getMonth() + 1;
      const day = photoDate.getDate();
      const year = photoDate.getFullYear();
      
      for (const person of people) {
        if (!person.birthdate) continue;
        
        const birthdate = new Date(person.birthdate);
        const birthMonth = birthdate.getMonth() + 1;
        const birthDay = birthdate.getDate();
        
        // Exact birthday match
        if (birthMonth === month && birthDay === day) {
          const age = year - birthdate.getFullYear();
          
          matches.push({
          });
        }
        // Near birthday (within 2 days)
        else if (birthMonth === month && Math.abs(birthDay - day) <= 2) {
          const age = year - birthdate.getFullYear();
          
          matches.push({
          });
        }
      }
      
      return matches;
    } catch (err) {
      error('Error detecting birthdays', "EventDetection", { error: err });
      return [];
    }
  }
  
  /**
   * Detect custom events for a given date
   */
  private async detectCustomEvents(photoDate: Date): Promise<EventMatch[]> {
    const matches: EventMatch[] = [];
    
    try {
      const events = await storage.getEvents?.() || [];
      const targetDate = new Date(photoDate.getFullYear(), photoDate.getMonth(), photoDate.getDate());
      
      for (const event of events) {
        if (!event.isEnabled) continue;
        
        const eventDate = new Date(event.date);
        let checkDate: Date;
        
        if (event.isRecurring && event.recurringType === 'yearly') {
          checkDate = new Date(photoDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        } else {
          checkDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        }
        
        // Check if dates match (within 1 day tolerance)
        const timeDiff = Math.abs(targetDate.getTime() - checkDate.getTime());
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 1) {
          let confidence = 100;
          if (daysDiff > 0) confidence = 85; // Slight penalty for near matches
          
          matches.push({
          });
        }
      }
      
      return matches;
    } catch (err) {
      error('Error detecting custom events', "EventDetection", { error: err });
      return [];
    }
  }
  
  /**
   * Calculate age of a person in a photo based on photo date and birthdate
   */
  calculateAgeInPhoto(birthdate: Date, photoDate: Date): number | null {
    try {
      if (!birthdate || !photoDate) return null;
      
      const birth = new Date(birthdate);
      const photo = new Date(photoDate);
      
      if (photo < birth) return null; // Can't be negative age
      
      let age = photo.getFullYear() - birth.getFullYear();
      const monthDiff = photo.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && photo.getDate() < birth.getDate())) {
        age--;
      }
      
      return age;
    } catch (err) {
      error('Error calculating age', "EventDetection", { error: err });
      return null;
    }
  }
  
  /**
   * Initialize default holiday settings
   */
  async initializeDefaultHolidays(): Promise<void> {
    try {
      const existing = await storage.getSettingByKey('enabled_holidays');
      if (!existing) {
        await storage.createSetting({
          key: 'enabled_holidays',
          value: JSON.stringify(['US']),
          description: 'Enabled holiday country codes',
          category: 'events'
        });
      }
    } catch (err) {
      error('Error initializing holiday settings', "EventDetection", { error: err });
    }
  }
  
  /**
   * Get available holiday country options
   */
  getAvailableHolidaySets(): Array<{code: string, name: string, count: number}> {
    return [
      { code: 'US', name: 'United States', count: US_HOLIDAYS.length },
      { code: 'UK', name: 'United Kingdom', count: UK_HOLIDAYS.length },
    ];
  }
}

export const eventDetectionService = new EventDetectionService();