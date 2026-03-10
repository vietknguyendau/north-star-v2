// Minnesota Golf Course Database
// Source: USGA NCRDB / MGA · Men's White/Blue tees
// Format: { name, city, slope, rating, par }

export const MN_COURSES = [
  // ── Twin Cities Metro
  { name:"Rum River Hills Golf Course", city:"Anoka", slope:130, rating:71.2, par:72 },
  { name:"Links at Northfork", city:"Ramsey", slope:132, rating:72.1, par:72 },
  { name:"Oak Marsh Golf Course", city:"Oakdale", slope:126, rating:70.8, par:71 },
  { name:"Eagle Valley Golf Course", city:"Woodbury", slope:124, rating:70.1, par:71 },
  { name:"Keller Golf Course", city:"Maplewood", slope:128, rating:70.4, par:72 },
  { name:"Edinburgh USA", city:"Brooklyn Park", slope:140, rating:73.5, par:72 },
  { name:"Dwan Golf Club", city:"Bloomington", slope:122, rating:69.8, par:71 },
  { name:"Braemar Golf Course", city:"Edina", slope:127, rating:70.6, par:71 },
  { name:"Hyland Greens Golf Course", city:"Bloomington", slope:112, rating:67.2, par:70 },
  { name:"Hiawatha Golf Course", city:"Minneapolis", slope:120, rating:69.3, par:73 },
  { name:"Theodore Wirth Golf Course", city:"Minneapolis", slope:119, rating:69.0, par:72 },
  { name:"Columbia Golf Course", city:"Minneapolis", slope:124, rating:70.2, par:71 },
  { name:"Meadowbrook Golf Course", city:"Hopkins", slope:118, rating:68.8, par:72 },
  { name:"Hollydale Golf Course", city:"Plymouth", slope:121, rating:69.5, par:72 },
  { name:"Stonebrooke Golf Club", city:"Shakopee", slope:133, rating:71.8, par:72 },
  { name:"The Wilds Golf Club", city:"Prior Lake", slope:140, rating:73.8, par:72 },
  { name:"Mystic Lake Golf Course", city:"Prior Lake", slope:126, rating:70.3, par:72 },
  { name:"Valleywood Golf Course", city:"Apple Valley", slope:123, rating:70.0, par:72 },
  { name:"Crystal Lake Golf Club", city:"Burnsville", slope:122, rating:69.7, par:71 },
  { name:"Crosswoods Golf Course", city:"Coon Rapids", slope:116, rating:68.4, par:71 },
  { name:"Majestic Oaks Golf Club - Platinum", city:"Ham Lake", slope:136, rating:72.6, par:72 },
  { name:"Majestic Oaks Golf Club - Gold", city:"Ham Lake", slope:132, rating:71.4, par:72 },
  { name:"Mississippi Dunes Golf Links", city:"Cottage Grove", slope:132, rating:71.6, par:72 },
  { name:"Fox Hollow Golf Club", city:"Rogers", slope:130, rating:71.0, par:72 },
  { name:"Cedar Creek Golf Course", city:"Albertville", slope:126, rating:70.2, par:72 },
  { name:"Pebble Creek Golf Club", city:"Becker", slope:128, rating:70.8, par:72 },
  { name:"Rich Spring Golf Course", city:"Cold Spring", slope:124, rating:70.1, par:72 },
  { name:"Chaska Town Course", city:"Chaska", slope:130, rating:71.2, par:72 },
  { name:"Bearpath Golf & Country Club", city:"Eden Prairie", slope:141, rating:74.1, par:72 },
  { name:"Bluff Creek Golf Course", city:"Chaska", slope:119, rating:68.9, par:71 },
  { name:"Daytona Golf Club", city:"Dayton", slope:122, rating:69.6, par:72 },
  { name:"Bunker Hills Golf Course - East/West", city:"Coon Rapids", slope:131, rating:71.5, par:72 },
  { name:"Bunker Hills Golf Course - West/North", city:"Coon Rapids", slope:129, rating:71.1, par:72 },
  { name:"Eastview Golf Club", city:"Apple Valley", slope:115, rating:67.8, par:70 },
  { name:"Emerald Greens Golf Course", city:"Hastings", slope:120, rating:69.2, par:72 },
  { name:"Fort Snelling Golf Course", city:"Minneapolis", slope:108, rating:66.8, par:70 },
  { name:"Goodrich Golf Course", city:"Maplewood", slope:115, rating:67.9, par:70 },
  { name:"Island View Golf Club", city:"Waconia", slope:128, rating:70.6, par:72 },
  { name:"Lakeview Golf of Orono", city:"Orono", slope:121, rating:69.4, par:72 },
  { name:"Manitou Ridge Golf Course", city:"White Bear Lake", slope:122, rating:69.7, par:71 },
  { name:"North Oaks Golf Club", city:"North Oaks", slope:138, rating:73.2, par:72 },
  { name:"Parkview Golf Club", city:"St. Paul", slope:118, rating:68.6, par:71 },
  { name:"Phalen Park Golf Course", city:"St. Paul", slope:116, rating:68.0, par:70 },
  { name:"Prestwick Golf Club", city:"Woodbury", slope:137, rating:73.0, par:72 },
  { name:"Ridges at Sand Creek", city:"Jordan", slope:131, rating:71.4, par:72 },
  { name:"River Oaks Golf Club", city:"Cottage Grove", slope:125, rating:70.3, par:71 },
  { name:"Rush Creek Golf Club", city:"Maple Grove", slope:138, rating:73.1, par:72 },
  { name:"Sawmill Golf Club", city:"Stillwater", slope:129, rating:71.0, par:72 },
  { name:"Shamrock Golf Course", city:"Corcoran", slope:120, rating:69.1, par:72 },
  { name:"St. Croix National Golf Club", city:"Somerset", slope:135, rating:72.4, par:72 },
  { name:"StoneRidge Golf Club", city:"Stillwater", slope:133, rating:71.9, par:72 },
  { name:"Sundance Golf Club", city:"Dayton", slope:124, rating:70.0, par:72 },
  { name:"Tanners Brook Golf Course", city:"Forest Lake", slope:124, rating:69.8, par:72 },
  { name:"Troy Burne Golf Club", city:"Hudson", slope:137, rating:73.0, par:72 },
  { name:"Wedgewood Golf Course", city:"Woodbury", slope:118, rating:68.5, par:70 },
  { name:"White Bear Lake Country Club", city:"White Bear Lake", slope:130, rating:71.1, par:72 },
  { name:"Willingers Golf Club", city:"Northfield", slope:136, rating:72.7, par:72 },
  { name:"Baker National Golf Course", city:"Medina", slope:129, rating:71.0, par:72 },
  { name:"Brookview Golf Course", city:"Golden Valley", slope:119, rating:68.9, par:72 },
  { name:"Cleary Lake Golf Course", city:"Prior Lake", slope:118, rating:68.7, par:71 },
  { name:"Como Golf Course", city:"St. Paul", slope:107, rating:65.8, par:70 },
  { name:"Inver Wood Golf Course", city:"Inver Grove Heights", slope:128, rating:70.7, par:72 },
  { name:"Oneka Ridge Golf Course", city:"White Bear Township", slope:126, rating:70.4, par:72 },
  { name:"Timber Creek Golf Course", city:"Watertown", slope:122, rating:69.5, par:72 },
  { name:"Afton Alps Golf Course", city:"Afton", slope:120, rating:69.2, par:71 },
  { name:"Applewood Hills Golf Course", city:"Stillwater", slope:122, rating:69.6, par:71 },
  { name:"Carriage Hills Golf Course", city:"Eagan", slope:119, rating:68.8, par:71 },
  { name:"Dakota Pines Golf Course", city:"Rosemount", slope:116, rating:68.1, par:71 },
  { name:"Falcon Ridge Golf Course", city:"Falcon Heights", slope:114, rating:67.5, par:70 },
  { name:"Greenfield Golf Course", city:"Greenfield", slope:120, rating:69.1, par:72 },
  { name:"Hidden Greens Golf Course", city:"Hastings", slope:117, rating:68.4, par:71 },
  { name:"Pioneer Creek Golf Course", city:"Maple Plain", slope:121, rating:69.4, par:72 },
  { name:"Raven Golf Club", city:"Albertville", slope:128, rating:70.5, par:72 },
  { name:"Southern Hills Golf Club", city:"Farmington", slope:125, rating:70.2, par:72 },
  // ── Greater MN
  { name:"Giants Ridge Golf - The Quarry", city:"Biwabik", slope:144, rating:74.3, par:72 },
  { name:"Giants Ridge Golf - The Legend", city:"Biwabik", slope:142, rating:74.0, par:72 },
  { name:"Duluth Golf Club", city:"Duluth", slope:131, rating:71.3, par:72 },
  { name:"Enger Park Golf Course", city:"Duluth", slope:124, rating:70.0, par:72 },
  { name:"Lester Park Golf Course", city:"Duluth", slope:121, rating:69.5, par:72 },
  { name:"Superior National Golf Course", city:"Lutsen", slope:145, rating:74.6, par:72 },
  { name:"Madden's Resort - Classic", city:"Brainerd", slope:136, rating:72.5, par:72 },
  { name:"Madden's Resort - Pine Beach East", city:"Brainerd", slope:128, rating:70.8, par:72 },
  { name:"Brainerd Golf Course", city:"Brainerd", slope:122, rating:69.6, par:72 },
  { name:"Cragun's Legacy Course", city:"Brainerd", slope:134, rating:72.2, par:72 },
  { name:"The Pines at Grand View Lodge", city:"Nisswa", slope:138, rating:73.0, par:72 },
  { name:"Deacon's Lodge", city:"Breezy Point", slope:140, rating:73.5, par:72 },
  { name:"Rochester Golf & Country Club", city:"Rochester", slope:134, rating:71.8, par:71 },
  { name:"Soldiers Memorial Field", city:"Rochester", slope:120, rating:69.2, par:72 },
  { name:"Eastwood Golf Course", city:"Rochester", slope:116, rating:68.1, par:71 },
  { name:"Northern Hills Golf Course", city:"Rochester", slope:118, rating:68.6, par:72 },
  { name:"Wedgewood Cove Golf Club", city:"Albert Lea", slope:131, rating:71.3, par:72 },
  { name:"The Jewel Golf Club", city:"Lake City", slope:136, rating:72.6, par:72 },
  { name:"River Oaks Municipal Golf", city:"Mankato", slope:124, rating:70.0, par:72 },
  { name:"Minnetonka Country Club", city:"Shorewood", slope:138, rating:73.2, par:72 },
  { name:"Ridgebrook Country Club", city:"Medina", slope:131, rating:71.4, par:72 },
  { name:"Wilderness at Fortune Bay", city:"Tower", slope:141, rating:73.8, par:72 },
  { name:"The Vardon Golf Club", city:"St. Cloud", slope:129, rating:71.0, par:72 },
  { name:"St. Cloud Country Club", city:"St. Cloud", slope:132, rating:71.6, par:72 },
  { name:"Elk River Country Club", city:"Elk River", slope:126, rating:70.3, par:72 },
  { name:"Blackberry Ridge Golf Club", city:"Sartell", slope:128, rating:70.7, par:72 },
  { name:"Izaty's Golf & Yacht Club", city:"Onamia", slope:130, rating:71.2, par:72 },
  { name:"Willmar Golf Course", city:"Willmar", slope:122, rating:69.6, par:72 },
  { name:"Alexandria Golf Club", city:"Alexandria", slope:128, rating:70.8, par:72 },
  { name:"Balmoral Golf Course", city:"Battle Lake", slope:124, rating:70.1, par:72 },
  { name:"Perham Lakeside Country Club", city:"Perham", slope:126, rating:70.4, par:72 },
  { name:"Detroit Lakes Country Club", city:"Detroit Lakes", slope:130, rating:71.1, par:72 },
  { name:"Bemidji Town & Country Club", city:"Bemidji", slope:128, rating:70.6, par:72 },
  { name:"Greenwood Golf Course", city:"Bemidji", slope:118, rating:68.5, par:71 },
  { name:"Thief River Falls Golf Club", city:"Thief River Falls", slope:120, rating:69.0, par:72 },
  { name:"Moorhead Country Club", city:"Moorhead", slope:128, rating:70.7, par:72 },
  { name:"Village Green Golf Course", city:"Moorhead", slope:116, rating:68.0, par:71 },
  { name:"Winona Country Club", city:"Winona", slope:130, rating:71.2, par:72 },
  { name:"Valley High Country Club", city:"Crookston", slope:118, rating:68.6, par:71 },
  { name:"Fairmont Golf Course", city:"Fairmont", slope:122, rating:69.5, par:72 },
  { name:"Marshall Golf Club", city:"Marshall", slope:120, rating:69.1, par:72 },
  { name:"Worthington Golf Club", city:"Worthington", slope:124, rating:70.0, par:72 },
];

// Combined course list — MN first, then WI
export const ALL_COURSES = [...MN_COURSES, ...WI_COURSES];

// Search function — returns top matches across MN + WI
export const searchCourses = (query) => {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return ALL_COURSES
    .filter(c => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q))
    .sort((a,b) => {
      // Prioritize name matches over city matches
      const aName = a.name.toLowerCase().indexOf(q);
      const bName = b.name.toLowerCase().indexOf(q);
      if (aName !== bName) return aName - bName;
      // MN slightly before WI for same-quality matches
      const aMN = a.city.includes(", WI") ? 1 : 0;
      const bMN = b.city.includes(", WI") ? 1 : 0;
      return aMN - bMN;
    })
    .slice(0, 10);
};

// ════════════════════════════════════════════════════════════════
// Wisconsin Golf Course Database
// Source: USGA NCRDB / WGA · Men's White/Blue tees
// ════════════════════════════════════════════════════════════════
export const WI_COURSES = [
  // ── Milwaukee Metro
  { name:"Brown Deer Park Golf Course", city:"Milwaukee, WI", slope:126, rating:70.8, par:72 },
  { name:"Dretzka Park Golf Course", city:"Milwaukee, WI", slope:120, rating:69.4, par:72 },
  { name:"Greenfield Park Golf Course", city:"Milwaukee, WI", slope:118, rating:68.9, par:71 },
  { name:"Whitnall Park Golf Course", city:"Milwaukee, WI", slope:124, rating:70.1, par:72 },
  { name:"Currie Park Golf Course", city:"Milwaukee, WI", slope:116, rating:68.2, par:70 },
  { name:"Oakwood Park Golf Course", city:"Franklin, WI", slope:128, rating:71.0, par:72 },
  { name:"Westmoor Country Club", city:"Brookfield, WI", slope:134, rating:72.2, par:72 },
  { name:"Brookfield Country Club", city:"Brookfield, WI", slope:130, rating:71.4, par:72 },
  { name:"Tuckaway Country Club", city:"Franklin, WI", slope:138, rating:73.1, par:72 },
  { name:"Erin Hills Golf Course", city:"Erin, WI", slope:148, rating:76.5, par:72 },
  { name:"The Club at Strawberry Creek", city:"Kenosha, WI", slope:128, rating:70.6, par:71 },
  { name:"Kettle Hills Golf Course - Valley", city:"Richfield, WI", slope:124, rating:70.0, par:72 },
  { name:"Kettle Hills Golf Course - Ponds", city:"Richfield, WI", slope:120, rating:69.2, par:72 },
  { name:"Maplecrest Country Club", city:"Kenosha, WI", slope:122, rating:69.8, par:72 },
  { name:"Petrifying Springs Golf Course", city:"Kenosha, WI", slope:119, rating:69.1, par:72 },
  { name:"Songbird Hills Golf Club", city:"Hartland, WI", slope:126, rating:70.4, par:72 },
  { name:"Hawks View Golf Club", city:"Lake Geneva, WI", slope:132, rating:71.8, par:72 },
  { name:"Grand Geneva Resort - Brute", city:"Lake Geneva, WI", slope:148, rating:75.2, par:72 },
  { name:"Grand Geneva Resort - Highlands", city:"Lake Geneva, WI", slope:132, rating:71.6, par:72 },
  { name:"Abbey Springs Golf Course", city:"Fontana, WI", slope:126, rating:70.2, par:72 },
  { name:"Geneva National - Palmer", city:"Lake Geneva, WI", slope:140, rating:74.0, par:72 },
  { name:"Geneva National - Player", city:"Lake Geneva, WI", slope:138, rating:73.4, par:72 },
  { name:"Geneva National - Trevino", city:"Lake Geneva, WI", slope:136, rating:72.8, par:72 },

  // ── Madison Metro
  { name:"University Ridge Golf Course", city:"Madison, WI", slope:138, rating:73.2, par:72 },
  { name:"Yahara Hills Golf Course - East", city:"Madison, WI", slope:122, rating:70.0, par:72 },
  { name:"Yahara Hills Golf Course - West", city:"Madison, WI", slope:120, rating:69.5, par:72 },
  { name:"Odana Hills Golf Course", city:"Madison, WI", slope:118, rating:68.8, par:72 },
  { name:"Monona Golf Course", city:"Madison, WI", slope:112, rating:67.4, par:70 },
  { name:"Maple Bluff Country Club", city:"Madison, WI", slope:134, rating:72.0, par:72 },
  { name:"Nakoma Golf Club", city:"Madison, WI", slope:130, rating:71.2, par:72 },
  { name:"Blackhawk Country Club", city:"Madison, WI", slope:132, rating:71.6, par:72 },
  { name:"The Bridges Golf Course", city:"Madison, WI", slope:128, rating:70.8, par:72 },
  { name:"Bishops Bay Country Club", city:"Middleton, WI", slope:136, rating:72.6, par:72 },
  { name:"Pleasant View Golf Course", city:"Middleton, WI", slope:120, rating:69.4, par:72 },
  { name:"Timber Ridge Golf Club", city:"Verona, WI", slope:122, rating:69.8, par:71 },
  { name:"Ironwood Golf Course", city:"Madison, WI", slope:116, rating:68.2, par:71 },

  // ── Western Wisconsin (St. Croix / Hudson area — close to Twin Cities)
  { name:"Hudson Golf Club", city:"Hudson, WI", slope:126, rating:70.6, par:72 },
  { name:"Clifton Highlands Golf Course", city:"Prescott, WI", slope:130, rating:71.4, par:72 },
  { name:"Kilkarney Hills Golf Club", city:"River Falls, WI", slope:124, rating:70.0, par:72 },
  { name:"Pheasant Hills Golf Course", city:"Hudson, WI", slope:120, rating:69.2, par:72 },
  { name:"St. Croix National Golf Club", city:"Somerset, WI", slope:136, rating:72.8, par:72 },
  { name:"Troy Burne Golf Club", city:"Hudson, WI", slope:138, rating:73.6, par:72 },
  { name:"Willow Run Golf Course", city:"Pewaukee, WI", slope:122, rating:69.6, par:71 },
  { name:"Indianhead Golf Club", city:"Mosinee, WI", slope:124, rating:70.2, par:72 },
  { name:"Skyline Golf Course", city:"Black River Falls, WI", slope:118, rating:68.8, par:72 },
  { name:"Deer Track Golf Club", city:"Osceola, WI", slope:126, rating:70.4, par:72 },
  { name:"Badlands Golf Course", city:"Hammond, WI", slope:128, rating:71.0, par:72 },

  // ── Green Bay / Fox Valley
  { name:"Brown County Golf Course", city:"Oneida, WI", slope:132, rating:71.8, par:72 },
  { name:"Ledgeview Golf Course", city:"De Pere, WI", slope:124, rating:70.0, par:72 },
  { name:"Thornberry Creek at Oneida", city:"Oneida, WI", slope:140, rating:74.2, par:72 },
  { name:"Glacier Wood Golf Club", city:"Iola, WI", slope:128, rating:70.8, par:72 },
  { name:"High Cliff Golf Course", city:"Sherwood, WI", slope:122, rating:69.4, par:72 },
  { name:"Reid Golf Course", city:"Appleton, WI", slope:120, rating:69.2, par:72 },
  { name:"Riverview Country Club", city:"Wausau, WI", slope:128, rating:71.0, par:72 },
  { name:"Sentryworld Golf Course", city:"Stevens Point, WI", slope:142, rating:74.8, par:72 },
  { name:"Stevens Point Country Club", city:"Stevens Point, WI", slope:126, rating:70.4, par:72 },

  // ── Kohler / Sheboygan (world-class destination)
  { name:"Whistling Straits - Straits", city:"Kohler, WI", slope:152, rating:76.9, par:72 },
  { name:"Whistling Straits - Irish", city:"Kohler, WI", slope:140, rating:73.8, par:72 },
  { name:"Blackwolf Run - River", city:"Kohler, WI", slope:148, rating:75.5, par:72 },
  { name:"Blackwolf Run - Meadow Valleys", city:"Kohler, WI", slope:140, rating:73.2, par:72 },
  { name:"The Bog Golf Course", city:"Saukville, WI", slope:136, rating:72.6, par:72 },
  { name:"Washington County Golf Course", city:"Hartford, WI", slope:122, rating:69.8, par:71 },

  // ── Door County
  { name:"Horseshoe Bay Golf Club", city:"Egg Harbor, WI", slope:130, rating:71.2, par:72 },
  { name:"Maxwelton Braes Golf Resort", city:"Baileys Harbor, WI", slope:124, rating:70.0, par:72 },
  { name:"The Orchards Golf Club", city:"Egg Harbor, WI", slope:128, rating:70.8, par:72 },

  // ── Northwoods Wisconsin
  { name:"Trout Lake Golf Club", city:"Arbor Vitae, WI", slope:128, rating:70.6, par:72 },
  { name:"Pinecrest Golf Club", city:"Waupaca, WI", slope:120, rating:69.2, par:72 },
  { name:"Northbrook Country Club", city:"Luxemburg, WI", slope:124, rating:70.0, par:72 },
  { name:"Forest Ridges Golf Course", city:"Minong, WI", slope:126, rating:70.4, par:72 },
  { name:"Teal Wing Golf Club", city:"Hayward, WI", slope:130, rating:71.4, par:72 },
  { name:"Voyager Village Country Club", city:"Danbury, WI", slope:122, rating:69.6, par:72 },
  { name:"Lake Arrowhead Golf Course - Lakes", city:"Nekoosa, WI", slope:132, rating:71.8, par:72 },
  { name:"Lake Arrowhead Golf Course - Pines", city:"Nekoosa, WI", slope:128, rating:70.8, par:72 },
  { name:"Wild Rock Golf Club", city:"Wisconsin Dells, WI", slope:140, rating:73.8, par:72 },
  { name:"Trappers Turn Golf Club - Arbor/Canyon", city:"Wisconsin Dells, WI", slope:134, rating:72.0, par:72 },
  { name:"Trappers Turn Golf Club - Canyon/Lake", city:"Wisconsin Dells, WI", slope:132, rating:71.6, par:72 },
  { name:"Christmas Mountain Village Golf", city:"Wisconsin Dells, WI", slope:124, rating:70.0, par:72 },

  // ── Eau Claire / Chippewa Valley
  { name:"Eau Claire Golf & Country Club", city:"Eau Claire, WI", slope:130, rating:71.2, par:72 },
  { name:"Hickory Hills Golf Course", city:"Eau Claire, WI", slope:120, rating:69.2, par:72 },
  { name:"Riverview Golf Course", city:"Chippewa Falls, WI", slope:118, rating:68.6, par:72 },
  { name:"Whispering Springs Golf Club", city:"Fond du Lac, WI", slope:128, rating:70.8, par:72 },

  // ── La Crosse Area
  { name:"La Crosse Country Club", city:"La Crosse, WI", slope:132, rating:71.6, par:72 },
  { name:"Burns Park Golf Course", city:"La Crosse, WI", slope:116, rating:68.0, par:70 },
  { name:"Drugan's Castle Mound", city:"Holmen, WI", slope:122, rating:69.6, par:72 },
  { name:"Pine Valley Golf Club", city:"Onalaska, WI", slope:126, rating:70.4, par:72 },
];
