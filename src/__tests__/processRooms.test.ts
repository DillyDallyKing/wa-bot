// __tests__/processRooms.test.ts


import { processRooms } from '../processRooms';

describe('processRooms', () => {
  it('should correctly extract the number of rooms for a given room type', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10 ROOMS (ECONOMY)
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

  it('it deals with ROOM - Economy', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10 ROOM (ECONOMY)
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

  it('it deals with ROOM(S) - Economy', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10 ROOMS (ECONOMY)
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

  it('it deals with ROOM - With no economy text ', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10 ROOM
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

  it('it deals with ROOM(S) - With no economy text ', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10 ROOMS
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

  it('should return 0 if the room type is not present', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10 ROOMS (BUSINESS)
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(0);
  });

  it('should handle cases where we ask for economy roomtype but the message does not have any typing of rooms', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      5 ROOMS
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(5);
  });

  it('Has both ECON and Bus Text', () => {
    const message = `Hi All,

    NEW DELAYED SQ ARR

    SQ303/BRU/18SEP/ETA 0727HRS

    NO. OF ROOMS
    02 ROOMS (BUSINESS)

    SQ351/CPH/18SEP/ETA 0658

    NO. OF ROOMS
    03 ROOMS (ECONOMY)
    02 ROOMS (BUSINESS)

    DEPARTURE
    MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(3);
  });

  it('Has both Business Comes first before economy Text', () => {
    const message = `Hi All,

    NEW DELAYED SQ ARR

    SQ303/BRU/18SEP/ETA 0727HRS

    NO. OF ROOMS
    02 ROOMS (BUSINESS)

    SQ351/CPH/18SEP/ETA 0658

    NO. OF ROOMS
    02 ROOMS (BUSINESS)
    03 ROOMS (ECONOMY)

    DEPARTURE
    MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(3);
  });

  it('it deals with 10ROOMS (ECONOMY)', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10ROOMS (ECONOMY)
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

  it('it deals with 10ROOM (ECONOMY)', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10ROOM (ECONOMY)
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

  it('it deals with 10ROOM', () => {
    const message = `
      Hi All,
      
      NEW DELAYED SQ ARR
      
      NO. OF ROOMS
      10ROOM
      
      DEPARTURE
      MULTIPLE
    `;
    expect(processRooms(message, 'ECONOMY')).toBe(10);
  });

});
