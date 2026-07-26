// utils/petData.ts

export const PET_SPECIES = [
    "Dog", "Cat", "Rabbit", "Guinea Pig", "Hamster", 
    "Bird", "Reptile", "Fish", "Horse", "Ferret", "Other (Exotic)"
];

export const BREEDS_BY_SPECIES: Record<string, string[]> = {
    "Dog": [
        "Mixed Breed / Mutt", "Labrador Retriever", "French Bulldog", "German Shepherd", 
        "Golden Retriever", "Bulldog", "Poodle (Standard/Miniature/Toy)", "Beagle", 
        "Rottweiler", "German Shorthaired Pointer", "Dachshund", "Pembroke Welsh Corgi", 
        "Australian Shepherd", "Yorkshire Terrier", "Boxer", "Cavalier King Charles Spaniel", 
        "Doberman Pinscher", "Great Dane", "Miniature Schnauzer", "Siberian Husky", 
        "Bernese Mountain Dog", "Cane Corso", "Shih Tzu", "Boston Terrier", "Pomeranian", 
        "Havanese", "English Springer Spaniel", "Shetland Sheepdog", "Brittany", 
        "Cocker Spaniel", "Border Collie", "Vizsla", "Pug", "Basset Hound", "Mastiff", 
        "Chihuahua", "Maltese", "Weimaraner", "Newfoundland", "Shiba Inu"
    ],
    "Cat": [
        "Domestic Shorthair", "Domestic Longhair", "Ragdoll", "Maine Coon", 
        "Exotic Shorthair", "Persian", "Devon Rex", "British Shorthair", "Abyssinian", 
        "American Shorthair", "Scottish Fold", "Sphynx", "Siamese", "Norwegian Forest Cat", 
        "Cornish Rex", "Bengal", "Russian Blue", "Siberian", "Burmese", "Birman", 
        "Tonkinese", "Oriental Shorthair"
    ],
    "Rabbit": [
        "Holland Lop", "Mini Rex", "Netherland Dwarf", "Lionhead", "Mini Lop", "Dutch", 
        "Flemish Giant", "English Angora", "Rex", "Californian", "New Zealand", "Polish", 
        "Harlequin", "English Spot", "Mixed Breed"
    ],
    "Guinea Pig": [
        "American (Short smooth coat)", "Abyssinian (Rosettes/swirls)", "Peruvian (Long hair)", 
        "Silkie (Sheltie)", "Teddy (Dense, wiry coat)", "Texel (Long curly hair)", 
        "White Crested", "Skinny Pig (Hairless)", "Baldwin"
    ],
    "Hamster": [
        "Syrian (Golden/Teddy Bear)", "Dwarf Campbell Russian", "Dwarf Winter White Russian", 
        "Roborovski (Robo)", "Chinese"
    ],
    "Bird": [
        "Parakeet (Budgerigar)", "Cockatiel", "Canary", "Finch (Zebra/Society/Gouldian)", 
        "Lovebird", "Conure (Green-Cheeked/Sun)", "African Grey", "Cockatoo", "Macaw", 
        "Amazon Parrot", "Parrotlet", "Eclectus", "Caique", "Dove/Pigeon"
    ],
    "Reptile": [
        "Bearded Dragon", "Ball Python", "Leopard Gecko", "Corn Snake", "Crested Gecko", 
        "Red-Eared Slider (Turtle)", "Russian Tortoise", "Blue-Tongued Skink", 
        "Boa Constrictor", "Chameleon (Veiled/Panther)", "Green Iguana", "King Snake"
    ],
    "Fish": [
        "Betta (Siamese Fighting Fish)", "Goldfish (Fantail/Comet/Common)", "Guppy", 
        "Tetra (Neon/Cardinal)", "Molly", "Platy", "Angelfish", "Cichlid (African/South American)", 
        "Corydoras Catfish", "Plecostomus (Algae Eater)"
    ],
    "Horse": [
        "Quarter Horse", "Thoroughbred", "Arabian", "Appaloosa", "Paint", "Morgan", 
        "Tennessee Walking Horse", "Warmblood", "Pony (Shetland/Welsh)", 
        "Draft (Clydesdale/Percheron)", "Grade (Mixed/Unknown)"
    ],
    "Ferret": [
        "Standard", "Angora"
    ]
};