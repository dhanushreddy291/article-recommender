import keras
import os
import numpy as np
import pandas as pd
from keras import layers
from sklearn.model_selection import train_test_split

should_test = False

from helpers.db_connector import get_db_connection

NUM_EPOCHS = 20
BATCH_SIZE = 32


def build_classification_model(input_size: int, num_classes: int) -> keras.Model:

    # Check if trained model exists

    inputs = keras.Input(shape=(input_size,))
    x = layers.Dense(64, activation="relu")(
        inputs
    )  # Assuming an intermediate dense layer
    outputs = layers.Dense(num_classes, activation="sigmoid")(x)
    model = keras.Model(inputs=inputs, outputs=outputs)
    return model


if __name__ == "__main__":
    if not os.path.exists("classification_model.keras"):
        # Get all rows in newsletter table
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, embedding, predicted_value
            FROM newsletter
            """
        )
        rows = cur.fetchall()

        # Convert to dataframe
        df = pd.DataFrame(rows, columns=["id", "embedding", "predicted_value"])

        # Convert embeddings to numeric type
        df["embedding"] = df["embedding"].apply(
            lambda x: np.fromstring(x[1:-1], sep=",").astype(np.float32)
        )

        # Split the data
        train_df, test_df = train_test_split(df, test_size=0.2)

        embedding_size = len(train_df["embedding"].iloc[0])

        classifier = build_classification_model(
            embedding_size, len(train_df["predicted_value"].unique())
        )

        classifier.compile(
            loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            metrics=["accuracy"],
        )

        NUM_EPOCHS = 20
        BATCH_SIZE = 32

        y_train = train_df["predicted_value"]
        x_train = np.stack(train_df["embedding"])
        y_val = test_df["predicted_value"]
        x_val = np.stack(test_df["embedding"])

        # Train the model for the desired number of epochs.
        callback = keras.callbacks.EarlyStopping(monitor="accuracy", patience=3)

        history = classifier.fit(
            x=x_train,
            y=y_train,
            validation_data=(x_val, y_val),
            callbacks=[callback],
            batch_size=BATCH_SIZE,
            epochs=NUM_EPOCHS,
        )

        # Save the model
        classifier.save("classification_model.keras")
        conn.close()
    elif should_test:
        print("Model already exists. Loading the model")
        classifier = keras.models.load_model("classification_model.keras")

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, embedding, predicted_value
            FROM newsletter
            """
        )

        rows = cur.fetchall()
        # Convert to dataframe
        df = pd.DataFrame(rows, columns=["id", "embedding", "predicted_value"])

        # Convert embeddings to numeric type
        df["embedding"] = df["embedding"].apply(
            lambda x: np.fromstring(x[1:-1], sep=",").astype(np.float32)
        )

        # Split the data
        train_df, test_df = train_test_split(df, test_size=0.2)

        y_val = test_df["predicted_value"]
        x_val = np.stack(test_df["embedding"])

        test_loss, test_acc = classifier.evaluate(x_val, y_val, verbose=2)
        print("\nTest accuracy:", test_acc)
