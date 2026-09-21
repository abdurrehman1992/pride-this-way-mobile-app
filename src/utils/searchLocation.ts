const searchLocation = async (query: string) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5`
    );

    const data = await response.json();

    // console.log(data);

  } catch (error) {
    // console.log(error);
  }
};