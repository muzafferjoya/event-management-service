import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { CreateEventDto } from 'src/modules/event/dto/create-event.dto';
import { ERROR_MESSAGES } from '../utils/constants.util';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { EndConditionType } from '../utils/types';

@Injectable()
export class DateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const eventStartDate = createEventDto.startDatetime.split('T')[0];
    const eventEndDate = createEventDto.endDatetime.split('T')[0];

    const startDate = new Date(createEventDto.startDatetime);
    const endDate = new Date(createEventDto.endDatetime);
    const currentDate = new Date();

    if (eventStartDate !== eventEndDate && createEventDto.isRecurring) {
      throw new BadRequestException(
        ERROR_MESSAGES.MULTIDAY_EVENT_NOT_RECURRING,
      );
    }
    if (startDate <= currentDate) {
      throw new BadRequestException(ERROR_MESSAGES.START_DATE_INVALID);
    }
    if (endDate < startDate) {
      throw new BadRequestException(ERROR_MESSAGES.END_DATE_INVALID);
    }

    return createEventDto;
  }
}

@Injectable()
export class RegistrationDateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const currentDate = new Date();
    const startDate = new Date(createEventDto.startDatetime);

    const registrationStartDate = createEventDto.registrationEndDate
      ? new Date(createEventDto.registrationStartDate)
      : null;
    const isRestricted = createEventDto.isRestricted;
    const registrationEndDate = createEventDto.registrationEndDate
      ? new Date(createEventDto.registrationEndDate)
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
  transform(createEventDto: CreateEventDto) {
    if (createEventDto.isRecurring) {
      const endConditionValue =
        createEventDto.recurrencePattern?.endCondition?.value;
      const endConditionType =
        createEventDto.recurrencePattern?.endCondition?.type;

      if (!endConditionType || !endConditionValue) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRING_PATTERN_REQUIRED,
        );
      }

      if (endConditionType === 'endDate') {
        const recurrenceEndDate = new Date(endConditionValue);

        const dateValid =
          recurrenceEndDate && !Number.isNaN(recurrenceEndDate.getTime());

        if (!dateValid) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_END_DATE_INVALID,
          );
        }

        const startDate = new Date(createEventDto.startDatetime);
        const currentDate = new Date();
        if (recurrenceEndDate < currentDate) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_END_DATE_SHOULD_BE_GREATER_THAN_CURRENT_DATE,
          );
        }

        if (recurrenceEndDate <= startDate) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_END_DATE_AFTER_EVENT_DATE,
          );
        }
        // createEventDto.recurrencePattern.endCondition.value = endDate;
      } else if (endConditionType === EndConditionType.occurrences) {
        const occurrences = Number(endConditionValue);

        if (!occurrences || occurrences < 1) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_OCCURRENCES_INVALID,
          );
        }
      } else if (
        endConditionType !== EndConditionType.occurrences &&
        endConditionType !== EndConditionType.endDate
      ) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRENCE_PATTERN_INVALID,
        );
      }
    } else if (
      !createEventDto.isRecurring &&
      Object.keys(createEventDto?.recurrencePattern ?? {})?.length
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.RECURRING_PATTERN_NOT_REQUIRED,
      );
    }

    return createEventDto;
  }
}

@Injectable()
export class AttendeesValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const attendees = createEventDto?.attendees;

    if (!createEventDto.isRestricted) {
      if (attendees && attendees.length) {
        throw new BadRequestException(ERROR_MESSAGES.ATTENDEES_NOT_REQUIRED);
      }
    }

    return createEventDto;
  }
}

@Injectable()
export class SearchDateValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    const { date, startDate, endDate } = value.filters || {};

    // Check if both startDate and endDate are passed with date
    if (date && (startDate || endDate)) {
      throw new BadRequestException(
        'Only one of date, startDate, or endDate should be provided.',
      );
    }

    // Check if after and before are provided with date
    if (date && (!date.after || !date.before)) {
      throw new BadRequestException(
        'Both "after" and "before" fields are required when date is provided.',
      );
    }

    if (
      startDate &&
      (!startDate.after || !startDate.before) &&
      endDate === undefined
    ) {
      throw new BadRequestException(
        'Both "after" and "before" fields are required when startDate is provided.',
      );
    }

    if (
      endDate &&
      (!endDate.after || !endDate.before) &&
      startDate === undefined
    ) {
      throw new BadRequestException(
        'Both "after" and "before" fields are required when endDate is provided.',
      );
    }

    if (startDate && endDate && (!startDate.after || !endDate.before)) {
      throw new BadRequestException(
        'if StartDate and EndDate Provided then "after" fields is required in startDate and "before fields is required in endDate',
      );
    }

    if (
      (date && new Date(date.after) > new Date(date.before)) ||
      (startDate &&
        !endDate &&
        new Date(startDate.after) > new Date(startDate.before)) ||
      (endDate &&
        !startDate &&
        new Date(endDate.after) > new Date(endDate.before)) ||
      (startDate &&
        endDate &&
        new Date(startDate.after) > new Date(endDate.before))
    ) {
      throw new BadRequestException(
        '"after" should be less than and equal to  "before" fields ',
      );
    }

    return value;
  }
}

@ValidatorConstraint({ name: 'endsWithZ', async: false })
export class EndsWithZConstraint implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    return typeof text === 'string' && text.endsWith('Z');
  }

  defaultMessage(args: ValidationArguments) {
    return '($value) must end with "Z"';
  }
}
