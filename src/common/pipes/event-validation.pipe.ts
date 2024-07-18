import { ConfigService } from '@nestjs/config';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { CreateEventDto } from 'src/modules/event/dto/create-event.dto';
import { getTimezoneDate } from '../utils/pipe.util';
import { ERROR_MESSAGES } from '../utils/constants.util';

@Injectable()
export class DateValidationPipe implements PipeTransform {
  constructor(private configService: ConfigService) {}

  transform(createEventDto: CreateEventDto) {
    const timeZone = this.configService.get<string>('TIMEZONE');
    const startDate = getTimezoneDate(
      timeZone,
      new Date(createEventDto.startDatetime),
    );
    const endDate = getTimezoneDate(
      timeZone,
      new Date(createEventDto.endDatetime),
    );
    const currentDate = getTimezoneDate(timeZone); // Current date in the specified timezone

    if (startDate <= currentDate) {
      throw new BadRequestException(
        'Start date must be today or a future date',
      );
    }
    if (endDate < startDate) {
      throw new BadRequestException(
        'End date should be greater than or equal to start date',
      );
    }
    return createEventDto;
  }
}

@Injectable()
export class RegistrationDateValidationPipe implements PipeTransform {
  constructor(private configService: ConfigService) {}

  transform(createEventDto: CreateEventDto) {
    const timeZone = this.configService.get<string>('TIMEZONE');
    const currentDate = getTimezoneDate(timeZone);
    const startDate = getTimezoneDate(
      timeZone,
      new Date(createEventDto.startDatetime),
    );
    const endDate = getTimezoneDate(
      timeZone,
      new Date(createEventDto.endDatetime),
    );
    const registrationStartDate = createEventDto.registrationEndDate
      ? getTimezoneDate(
          timeZone,
          new Date(createEventDto.registrationStartDate),
        )
      : null;
    const isRestricted = createEventDto.isRestricted;
    const registrationEndDate = createEventDto.registrationEndDate
      ? getTimezoneDate(timeZone, new Date(createEventDto.registrationEndDate))
      : null;

    // Ensure registration dates are not provided for restricted events

    if (
      (createEventDto.isRestricted && registrationStartDate) ||
      (createEventDto.isRestricted && registrationEndDate)
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.RESTRICTED_EVENT_NO_REGISTRATION_DATE,
      );
    }

    // Ensure registration dates are not in the past
    if (registrationStartDate < currentDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_INVALID,
      );
    }

    if (registrationEndDate < currentDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_END_DATE_INVALID,
      );
    }

    // Validate registration dates
    if (registrationStartDate > registrationEndDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_BEFORE_END_DATE,
      );
    }

    // Registration period must fall between the event period
    if (registrationStartDate > startDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_BEFORE_EVENT_DATE,
      );
    }

    if (registrationEndDate > startDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_END_DATE_BEFORE_EVENT_DATE,
      );
    }

    return createEventDto;
  }
}

export class RecurringEndDateValidationPipe implements PipeTransform {
  constructor(private configService: ConfigService) {}

  transform(createEventDto: CreateEventDto) {
    const timeZone = this.configService.get<string>('TIMEZONE');
    if (createEventDto.isRecurring) {
      const recurrenceEndDate = new Date(createEventDto.recurrenceEndDate);
      const startDate = new Date(createEventDto.startDatetime);
      const currentDate = getTimezoneDate(timeZone);
      if (recurrenceEndDate < currentDate) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRENCE_END_DATE_INVALID,
        );
      }

      if (recurrenceEndDate < startDate) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRENCE_END_DATE_BEFORE_EVENT_DATE,
        );
      }
    }

    return createEventDto;
  }
}

@Injectable()
export class ParamsValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    if (createEventDto.isRestricted) {
      const params = createEventDto.params;
      if (!params || typeof params !== 'object') {
        throw new BadRequestException('Invalid params object');
      }

      // if (!params.cohortIds && !params.userIds) {
      //   throw new BadRequestException(
      //     'Either cohortIds or userIds must be provided in params',
      //   );
      // }

      // if (params.cohortIds && params.userIds) {
      //   throw new BadRequestException(
      //     'Only one of cohortIds or userIds should be provided in params',
      //   );
      // }

      // if (params.cohortIds) {
      //   this.validateUUIDs(params.cohortIds);
      // } else if (params.userIds) {
      //   this.validateUUIDs(params.userIds);
      // }
    } else if (!createEventDto.isRestricted) {
      createEventDto.params = {};
    }

    return createEventDto;
  }

  private validateUUIDs(ids: string[]) {
    const uuidRegex = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i; // UUID regex pattern
    for (const id of ids) {
      if (!uuidRegex.test(id)) {
        throw new BadRequestException(`Invalid UUID format: ${id}`);
      }
    }
  }
}
