# Binary target
TARGET := collector

# Code sources
SRC_DIR := src
LIB_DIR := lib
BUILD_DIR := build

SRC_FILES := $(wildcard $(SRC_DIR)/*.c) $(wildcard $(LIB_DIR)/*.c)
OBJS := $(SRC_FILES:%=$(BUILD_DIR)/%.o)

# Compiler settings
CC := gcc
CFLAGS := -Wall -Wextra -O2 -I$(LIB_DIR)


# Default target
all: $(TARGET)

# Link the final binary
$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^

$(BUILD_DIR)/%.c.o: %.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MMD -MP -c $< -o $@

-include $(OBJS:.o=.d)

clean:
	rm -rf $(BUILD_DIR) $(TARGET)

run: $(TARGET)
	./$(TARGET)

.PHONY: all clean run
