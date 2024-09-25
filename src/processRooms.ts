export function processRooms(inputText: string, roomType: string): number {
  // Step 1: Break the input text into an array of lines
  const linesArray = inputText.split(/\r?\n/).filter(line => line.trim() !== '');

  // Step 2: Filter out lines containing the word "ROOM" or "ROOMS"
  const roomLines = linesArray.filter(line => /ROOMS?/.test(line));

  let totalRooms = 0;
  const roomTypeUpper = roomType.toUpperCase();
  let foundRoomType = false;

  for (let line of roomLines) {
    const upperCaseLine = line.toUpperCase();

    // Check if the line contains the specified roomType
    if (roomType && upperCaseLine.includes(roomTypeUpper)) {
      const match = line.match(/(\d+)\s*ROOMS?/);
      if (match) {
        totalRooms += parseInt(match[1], 10);
        foundRoomType = true; // Mark that we found the roomType
        return totalRooms;
      }
    }
  }

  // If the specified roomType is not found, check if we can get a number of rooms without type
  if (!foundRoomType) {
    for (let line of roomLines) {
      // Updated regex to check for no additional characters after "ROOM" or "ROOMS"
      const match = line.match(/(\d+)\s*ROOMS?\s*$/);
      if (match) {
        totalRooms += parseInt(match[1], 10);
        break; // Stop searching once we found the first occurrence of "ROOMS"
      }
    }
  }

  return totalRooms; // Return the total number of rooms found, or 0 if none
}
