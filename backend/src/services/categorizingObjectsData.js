// Bounds are measured in pixels on the supplied 1280 x 720 slides.
const item = (id, label, bounds, groups = []) => ({ id, label, bounds, groups });
export const oddItems = [
  item('icecream','Ice cream',[150,150,175,325]), item('balloon','Balloon',[415,140,80,180],['non-food']),
  item('popcorn','Popcorn',[585,140,150,230]), item('pot','Cooking pot',[775,90,200,125],['non-food']),
  item('peas','Peas',[1000,70,170,250]), item('pizza','Pizza',[375,335,165,115]),
  item('trophy','Trophy',[790,215,170,270],['non-food']), item('mug','Mug',[1025,330,165,125],['non-food']),
  item('pan','Frying pan',[65,480,290,140],['non-food']), item('banana','Banana',[390,505,145,80]),
  item('carrots','Carrots',[595,395,135,210]), item('glasses','Glasses',[790,495,180,130],['non-food']),
  item('cookie','Cookie',[1010,480,160,150]),
];
export const pairItems = [
  item('binbag','Rubbish bag',[95,82,88,100],['cleaning','kitchen','black']),
  item('bucket','Bucket',[235,82,110,120],['cleaning','bathroom','blue','container']),
  item('bath','Bath',[385,94,156,91],['bathroom','white','container']),
  item('ashtray','Ashtray',[575,95,120,85],['glass','container']),
  item('bed','Bed',[740,88,150,100],['bedroom','furniture','white','rest']),
  item('opener','Corkscrew',[925,85,115,110],['kitchen','metal','tools','drinks']),
  item('desk','Desk',[1050,95,130,95],['office','furniture','wood']),
  item('belt','Belt',[70,205,170,99],['clothing','accessories','black','bedroom']),
  item('chair','Chair',[274,207,72,111],['furniture','wood','office']),
  item('brush','Cleaning brush',[387,215,136,84],['cleaning','wood']),
  item('ring','Ring',[360,282,58,44],['jewellery','accessories','metal','dressing']),
  item('bracelet','Bracelet',[570,235,104,58],['jewellery','accessories','dressing']),
  item('bowl','Bowl',[695,217,137,81],['kitchen','container','dishes','green']),
  item('apron','Apron',[853,190,98,125],['kitchen','clothing','black']),
  item('cup','Cup',[963,219,107,78],['kitchen','dishes','container','drinks']),
  item('cushion','Cushion',[1087,200,97,102],['soft','bedroom','living room','rest','red']),
  item('curtains','Curtains',[75,322,105,137],['fabric','bedroom','living room','white']),
  item('comb','Comb',[216,340,168,58],['hair care','bathroom','dressing','black']),
  item('door','Door',[441,316,76,149],['wood','fixtures']),
  item('dishwasher','Dishwasher',[535,330,150,116],['kitchen','appliances','dishes','cleaning','white']),
  item('extinguisher','Fire extinguisher',[699,303,61,128],['safety','red','metal']),
  item('duster','Feather duster',[785,315,72,132],['cleaning']),
  item('fan','Fan',[872,310,98,131],['appliances','bedroom','white','electric']),
  item('glass','Drinking glass',[980,309,64,121],['glass','container','kitchen','drinks']),
  item('fridge','Fridge',[1066,308,96,125],['kitchen','appliances','white','food storage']),
  item('earrings','Earrings',[79,480,88,82],['jewellery','accessories','blue','dressing']),
  item('clock','Clock',[191,414,113,110],['living room','bedroom','white']),
  item('board','Chopping board',[310,400,123,120],['kitchen','wood','food preparation']),
  item('fork','Fork',[431,466,37,130],['kitchen','metal','dishes']),
  item('fireplace','Fireplace',[488,477,111,112],['living room','fixtures','warmth','white']),
  item('dryer','Hair dryer',[621,457,92,117],['hair care','bathroom','dressing','appliances','black','electric']),
  item('hairbrush','Hair brush',[722,465,143,67],['hair care','bathroom','dressing','red']),
  item('grater','Grater',[874,444,57,117],['kitchen','metal','food preparation']),
  item('mirror','Mirror',[949,436,71,139],['glass','bathroom','bedroom','dressing']),
  item('lipstick','Lipstick',[1040,432,37,105],['dressing','bathroom','accessories','red']),
  item('laptop','Laptop',[1090,458,109,79],['office','electric','black']),
  item('dress','Dress',[73,572,99,126],['clothing','fabric','red','dressing','bedroom']),
  item('bedding','Bedding',[174,537,129,92],['bedroom','soft','fabric','white','rest','warmth']),
  item('handle','Door handle',[322,534,106,117],['fixtures','metal']),
  item('firstaid','First aid kit',[196,624,102,92],['safety','green','container']),
  item('microwave','Microwave',[378,634,106,71],['kitchen','appliances','white','electric']),
  item('switch','Light switch',[512,589,85,90],['lighting','electric','fixtures','white']),
  item('bulb','Light bulb',[618,575,70,125],['lighting','electric','glass']),
  item('lamp','Lamp',[709,527,58,171],['lighting','electric','bedroom','living room']),
  item('scales','Scales',[772,546,79,89],['bathroom','appliances','black']),
  item('rug','Rug',[850,573,132,91],['soft','fabric','living room','bedroom']),
  item('saw','Saw',[1057,561,130,52],['tools','metal']),
  item('gloves','Rubber gloves',[998,598,87,95],['cleaning','clothing','yellow']),
  item('ruler','Ruler',[775,675,236,32],['tools','office','yellow']),
  item('tongs','Tongs',[1091,625,97,79],['kitchen','metal','tools']),
];

export function pairConnection(a, b) {
  if ([a.id, b.id].includes('fireplace') && [a.id, b.id].includes('extinguisher')) return 'one holds a fire for warmth and the other puts a fire out';
  const group = a.groups.find(value => b.groups.includes(value));
  if (!group) return null;
  const reasons = {
    'dressing': 'both can be part of getting dressed or ready',
    'hair care': 'both are used to look after hair',
    'cleaning': 'both can be used for cleaning',
    'drinks': 'both can be used when preparing or serving drinks',
    'food preparation': 'both help with preparing food',
    'rest': 'both can help us rest comfortably',
    'warmth': 'both can help keep us warm',
    'fixtures': 'both can be fittings in a home',
  };
  if (reasons[group]) return reasons[group];
  if (['bedroom','bathroom','kitchen','living room','office'].includes(group)) return `both can be found in a ${group}`;
  if (['black','white','blue','red','green','yellow'].includes(group)) return `both have ${group} parts in these pictures`;
  if (['wood','metal','glass','fabric'].includes(group)) return `both include ${group}`;
  return `both relate to ${group}`;
}
